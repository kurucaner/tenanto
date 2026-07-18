import {
  leaseTenantMembershipsDb,
  MaxSecondaryOccupantsError,
  SecondaryOccupantNotFoundError,
} from "@/db/lease-tenant-memberships";
import { LongStayNotActiveError } from "@/db/property-long-stays";
import { tenantUsersDb } from "@/db/tenant-users";
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

import { buildSecondaryOccupantMutationResponse } from "./resolve-secondary-tenant-contacts-service";
import {
  LINKED_TENANT_EMAIL_CHANGE_MESSAGE,
  LINKED_TENANT_VERIFIED_PHONE_CHANGE_MESSAGE,
  LinkedTenantContactError,
} from "./update-primary-tenant-contact-service";

const PENDING_MEMBERSHIP_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_ACCEPTANCE,
  TenantMembershipStatus.PENDING_INVITE,
]);

function assertLeaseActive(lease: IPropertyLongStay): void {
  if (lease.status !== PropertyLongStayStatus.ACTIVE) {
    throw new LongStayNotActiveError();
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
    throw new LinkedTenantContactError(LINKED_TENANT_EMAIL_CHANGE_MESSAGE);
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
    throw new LinkedTenantContactError(LINKED_TENANT_VERIFIED_PHONE_CHANGE_MESSAGE);
  }
}

async function loadSecondaryMembershipForLease(leaseId: string, membershipId: string) {
  const membership = await leaseTenantMembershipsDb.findById(membershipId);
  if (!membership || membership.leaseId !== leaseId) {
    throw new SecondaryOccupantNotFoundError();
  }
  if (membership.role !== TenantMembershipRole.SECONDARY) {
    throw new SecondaryOccupantNotFoundError();
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
      throw new SecondaryOccupantNotFoundError();
    }
    return buildSecondaryOccupantMutationResponse(updated);
  }

  if (membership.status === TenantMembershipStatus.ACTIVE && membership.tenantUserId == null) {
    const updated = await leaseTenantMembershipsDb.updateSecondaryContact(
      membership.id,
      membershipPatch
    );
    if (!updated) {
      throw new SecondaryOccupantNotFoundError();
    }
    return buildSecondaryOccupantMutationResponse(updated);
  }

  throw new SecondaryOccupantNotFoundError();
}

export async function createSecondaryOccupant(input: {
  body: ICreateSecondaryOccupantBody;
  invitedBy: string;
  lease: IPropertyLongStay;
}) {
  assertLeaseActive(input.lease);

  const count = await leaseTenantMembershipsDb.countNonTerminalSecondariesForLease(input.lease.id);
  if (count >= MAX_SECONDARY_OCCUPANTS) {
    throw new MaxSecondaryOccupantsError(MAX_SECONDARY_OCCUPANTS);
  }

  const inviteEmail = normalizeOptionalInviteEmail(input.body.email);
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
    throw new SecondaryOccupantNotFoundError();
  }

  const updated = await leaseTenantMembershipsDb.transitionStatus(
    membership.id,
    TenantMembershipStatus.ENDED
  );
  if (!updated) {
    throw new SecondaryOccupantNotFoundError();
  }
  return updated;
}

export { LinkedTenantContactError, MaxSecondaryOccupantsError, SecondaryOccupantNotFoundError };
