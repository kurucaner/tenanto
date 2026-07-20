import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  linkedTenantContactError,
  longStayNotActiveError,
  maxSecondaryOccupantsError,
  secondaryOccupantEmailMatchesPrimaryError,
  secondaryOccupantNotFoundError,
} from "@/errors/lease-errors";
import {
  type ICreateSecondaryOccupantBody,
  type IPropertyLongStay,
  type IUpdateSecondaryOccupantBody,
  MAX_SECONDARY_OCCUPANTS,
  normalizeOptionalInviteEmail,
  normalizeTenantEmail,
  normalizeToE164,
  PropertyLongStayStatus,
  resolveSecondaryTenantContact,
  TenantMembershipRole,
  TenantMembershipStatus,
  type TTenantMembershipStatus,
} from "@/packages/shared";

import { resolvePrimaryTenantContactForLongStay } from "./lease-primary-tenant-contact-service";
import { buildSecondaryOccupantMutationResponse } from "./resolve-secondary-tenant-contacts-service";
import {
  LINKED_TENANT_EMAIL_CHANGE_MESSAGE,
  LINKED_TENANT_VERIFIED_PHONE_CHANGE_MESSAGE,
} from "./update-primary-tenant-contact-service";

const PENDING_MEMBERSHIP_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_ACCEPTANCE,
  TenantMembershipStatus.PENDING_INVITE,
]);

function assertLeaseActive(lease: IPropertyLongStay): void {
  if (lease.status !== PropertyLongStayStatus.ACTIVE) {
    throw longStayNotActiveError();
  }
}

function normalizeNullablePhone(phone: string | null | undefined): string | null {
  if (phone == null || phone.trim() === "") {
    return null;
  }
  return normalizeToE164(phone.trim()) ?? null;
}

function hasSecondaryContactPatch(patch: IUpdateSecondaryOccupantBody): boolean {
  return patch.email !== undefined || patch.name !== undefined || patch.phone !== undefined;
}

async function assertSecondaryEmailDoesNotMatchPrimary(
  lease: IPropertyLongStay,
  inviteEmail: string | null
): Promise<void> {
  if (inviteEmail == null) {
    return;
  }

  const primary = await resolvePrimaryTenantContactForLongStay(lease);
  const primaryEmail = primary.effectiveEmail?.trim();
  if (!primaryEmail) {
    return;
  }

  if (normalizeTenantEmail(primaryEmail) === normalizeTenantEmail(inviteEmail)) {
    throw secondaryOccupantEmailMatchesPrimaryError();
  }
}

function assertLinkedEmailUnchanged(
  patch: IUpdateSecondaryOccupantBody,
  tenantEmail: string
): void {
  if (patch.email === undefined) {
    return;
  }

  const nextEmail = patch.email?.trim() || null;
  const currentEmail = normalizeTenantEmail(tenantEmail);
  const normalizedNext = nextEmail ? normalizeTenantEmail(nextEmail) : null;
  if (normalizedNext !== currentEmail) {
    throw linkedTenantContactError(LINKED_TENANT_EMAIL_CHANGE_MESSAGE);
  }
}

function assertVerifiedPhoneUnchanged(
  patch: IUpdateSecondaryOccupantBody,
  tenantPhone: string | null,
  phoneVerifiedAt: string | null
): void {
  if (patch.phone === undefined || phoneVerifiedAt == null) {
    return;
  }

  const nextPhone = normalizeNullablePhone(patch.phone);
  const currentPhone = normalizeNullablePhone(tenantPhone);
  if (nextPhone !== currentPhone) {
    throw linkedTenantContactError(LINKED_TENANT_VERIFIED_PHONE_CHANGE_MESSAGE);
  }
}

async function loadSecondaryMembershipForLease(leaseId: string, membershipId: string) {
  const membership = await leaseTenantMembershipsDb.findById(membershipId);
  if (!membership || membership.leaseId !== leaseId) {
    throw secondaryOccupantNotFoundError();
  }
  if (membership.role !== TenantMembershipRole.SECONDARY) {
    throw secondaryOccupantNotFoundError();
  }
  return membership;
}

async function updateLinkedSecondaryTenantContact(
  membership: Awaited<ReturnType<typeof loadSecondaryMembershipForLease>>,
  patch: IUpdateSecondaryOccupantBody,
  tenantUser: NonNullable<Awaited<ReturnType<typeof tenantUsersDb.findById>>>
) {
  assertLinkedEmailUnchanged(patch, tenantUser.email);
  assertVerifiedPhoneUnchanged(patch, tenantUser.phone, tenantUser.phoneVerifiedAt);

  let updatedUser = tenantUser;
  if (patch.name !== undefined) {
    const nextName = patch.name.trim();
    if (nextName !== tenantUser.name) {
      updatedUser = await tenantUsersDb.updateName(tenantUser.id, nextName);
    }
  }

  if (patch.phone !== undefined && tenantUser.phoneVerifiedAt == null) {
    const nextPhone = normalizeNullablePhone(patch.phone);
    if (nextPhone !== normalizeNullablePhone(updatedUser.phone)) {
      updatedUser = await tenantUsersDb.updateUnverifiedPhone(updatedUser.id, nextPhone);
    }
  }

  return buildSecondaryOccupantMutationResponse(membership);
}

async function updateUnlinkedSecondaryTenantContact(
  membership: Awaited<ReturnType<typeof loadSecondaryMembershipForLease>>,
  patch: IUpdateSecondaryOccupantBody
) {
  const membershipPatch: {
    contactPhone?: string | null;
    displayName?: string;
    inviteEmail?: string | null;
  } = {};

  if (patch.name !== undefined) {
    membershipPatch.displayName = patch.name;
  }
  if (patch.email !== undefined) {
    membershipPatch.inviteEmail = normalizeOptionalInviteEmail(patch.email);
  }
  if (patch.phone !== undefined) {
    membershipPatch.contactPhone = normalizeNullablePhone(patch.phone);
  }

  if (
    membership.status === TenantMembershipStatus.LISTED ||
    PENDING_MEMBERSHIP_STATUSES.has(membership.status)
  ) {
    const updated = await leaseTenantMembershipsDb.updateSecondaryContact(
      membership.id,
      membershipPatch
    );
    if (!updated) {
      throw secondaryOccupantNotFoundError();
    }
    return buildSecondaryOccupantMutationResponse(updated);
  }

  if (membership.status === TenantMembershipStatus.ACTIVE && membership.tenantUserId == null) {
    const updated = await leaseTenantMembershipsDb.updateSecondaryContact(
      membership.id,
      membershipPatch
    );
    if (!updated) {
      throw secondaryOccupantNotFoundError();
    }
    return buildSecondaryOccupantMutationResponse(updated);
  }

  throw secondaryOccupantNotFoundError();
}

export async function createSecondaryOccupant(input: {
  body: ICreateSecondaryOccupantBody;
  invitedBy: string;
  lease: IPropertyLongStay;
}) {
  assertLeaseActive(input.lease);

  const count = await leaseTenantMembershipsDb.countNonTerminalSecondariesForLease(input.lease.id);
  if (count >= MAX_SECONDARY_OCCUPANTS) {
    throw maxSecondaryOccupantsError(MAX_SECONDARY_OCCUPANTS);
  }

  const inviteEmail = normalizeOptionalInviteEmail(input.body.email);
  await assertSecondaryEmailDoesNotMatchPrimary(input.lease, inviteEmail);
  const membership = await leaseTenantMembershipsDb.createListedSecondary({
    contactPhone: normalizeNullablePhone(input.body.phone),
    displayName: input.body.name.trim(),
    invitedBy: input.invitedBy,
    inviteEmail,
    leaseId: input.lease.id,
  });

  return buildSecondaryOccupantMutationResponse(membership);
}

export async function updateSecondaryOccupant(input: {
  body: IUpdateSecondaryOccupantBody;
  lease: IPropertyLongStay;
  membershipId: string;
}) {
  assertLeaseActive(input.lease);
  if (!hasSecondaryContactPatch(input.body)) {
    const membership = await loadSecondaryMembershipForLease(input.lease.id, input.membershipId);
    return buildSecondaryOccupantMutationResponse(membership);
  }

  const membership = await loadSecondaryMembershipForLease(input.lease.id, input.membershipId);
  if (input.body.email !== undefined) {
    await assertSecondaryEmailDoesNotMatchPrimary(
      input.lease,
      normalizeOptionalInviteEmail(input.body.email)
    );
  }
  const tenantUser =
    membership.tenantUserId != null ? await tenantUsersDb.findById(membership.tenantUserId) : null;
  const resolved = resolveSecondaryTenantContact(membership, tenantUser);

  if (resolved?.source === "linked_user" && tenantUser) {
    return updateLinkedSecondaryTenantContact(membership, input.body, tenantUser);
  }

  return updateUnlinkedSecondaryTenantContact(membership, input.body);
}

export async function deleteSecondaryOccupant(input: {
  lease: IPropertyLongStay;
  membershipId: string;
}) {
  assertLeaseActive(input.lease);

  const membership = await loadSecondaryMembershipForLease(input.lease.id, input.membershipId);
  if (
    membership.status === TenantMembershipStatus.ENDED ||
    membership.status === TenantMembershipStatus.DECLINED ||
    membership.status === TenantMembershipStatus.REVOKED ||
    membership.status === TenantMembershipStatus.EXPIRED
  ) {
    throw secondaryOccupantNotFoundError();
  }

  const updated = await leaseTenantMembershipsDb.transitionStatus(
    membership.id,
    TenantMembershipStatus.ENDED
  );
  if (!updated) {
    throw secondaryOccupantNotFoundError();
  }
  return updated;
}
