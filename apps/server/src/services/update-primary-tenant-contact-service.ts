import {
  leaseTenantMembershipsDb,
  loadPrimaryMembershipForLease,
} from "@/db/lease-tenant-memberships";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  type ITenantUser,
  type IUpdatePropertyLongStayBody,
  normalizeTenantEmail,
  normalizeToE164,
  resolvePrimaryTenantContact,
  TenantMembershipStatus,
  type TTenantMembershipStatus,
} from "@/packages/shared";

export const LINKED_TENANT_EMAIL_CHANGE_MESSAGE =
  "Cannot change email for a tenant linked to a portal account. The tenant must use their portal account email.";

export const LINKED_TENANT_VERIFIED_PHONE_CHANGE_MESSAGE =
  "Cannot change a verified tenant phone from the lease. The tenant can update their phone in the portal.";

export class LinkedTenantContactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkedTenantContactError";
  }
}

export type TPrimaryTenantContactPatch = Pick<
  IUpdatePropertyLongStayBody,
  "guestName" | "tenantEmail" | "tenantPhone"
>;

const PENDING_MEMBERSHIP_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_ACCEPTANCE,
  TenantMembershipStatus.PENDING_INVITE,
]);

function hasPrimaryContactPatch(patch: TPrimaryTenantContactPatch): boolean {
  return (
    patch.guestName !== undefined ||
    patch.tenantEmail !== undefined ||
    patch.tenantPhone !== undefined
  );
}

function normalizeNullablePhone(phone: string | null | undefined): string | null {
  if (phone == null || phone.trim() === "") {
    return null;
  }
  return normalizeToE164(phone.trim()) ?? null;
}

function assertLinkedEmailUnchanged(patch: TPrimaryTenantContactPatch, tenantEmail: string): void {
  if (patch.tenantEmail === undefined) {
    return;
  }

  const nextEmail = patch.tenantEmail?.trim() || null;
  const currentEmail = normalizeTenantEmail(tenantEmail);
  const normalizedNext = nextEmail ? normalizeTenantEmail(nextEmail) : null;
  if (normalizedNext !== currentEmail) {
    throw new LinkedTenantContactError(LINKED_TENANT_EMAIL_CHANGE_MESSAGE);
  }
}

function assertVerifiedPhoneUnchanged(
  patch: TPrimaryTenantContactPatch,
  tenantPhone: string | null,
  phoneVerifiedAt: string | null
): void {
  if (patch.tenantPhone === undefined || phoneVerifiedAt == null) {
    return;
  }

  const nextPhone = normalizeNullablePhone(patch.tenantPhone);
  const currentPhone = normalizeNullablePhone(tenantPhone);
  if (nextPhone !== currentPhone) {
    throw new LinkedTenantContactError(LINKED_TENANT_VERIFIED_PHONE_CHANGE_MESSAGE);
  }
}

async function updateLinkedPrimaryTenantContact(
  lease: IPropertyLongStay,
  patch: TPrimaryTenantContactPatch,
  tenantUser: ITenantUser
): Promise<IPropertyLongStay> {
  assertLinkedEmailUnchanged(patch, tenantUser.email);
  assertVerifiedPhoneUnchanged(patch, tenantUser.phone, tenantUser.phoneVerifiedAt);

  let updatedUser = tenantUser;
  const nextName = patch.guestName?.trim() ?? tenantUser.name;
  if (nextName !== tenantUser.name) {
    updatedUser = await tenantUsersDb.updateName(tenantUser.id, nextName);
  }

  if (patch.tenantPhone !== undefined && tenantUser.phoneVerifiedAt == null) {
    const nextPhone = normalizeNullablePhone(patch.tenantPhone);
    if (nextPhone !== normalizeNullablePhone(updatedUser.phone)) {
      updatedUser = await tenantUsersDb.updateUnverifiedPhone(updatedUser.id, nextPhone);
    }
  }

  return propertyLongStaysDb.updateLease(lease.id, {
    guestName: updatedUser.name,
    tenantEmail: updatedUser.email,
    tenantPhone: updatedUser.phone,
  });
}

async function updateUnlinkedPrimaryTenantContact(
  lease: IPropertyLongStay,
  patch: TPrimaryTenantContactPatch,
  membership: ILeaseTenantMembership | null
): Promise<IPropertyLongStay> {
  const leasePatch: IUpdatePropertyLongStayBody = {};
  if (patch.guestName !== undefined) {
    leasePatch.guestName = patch.guestName;
  }
  if (patch.tenantEmail !== undefined) {
    leasePatch.tenantEmail = patch.tenantEmail;
  }
  if (patch.tenantPhone !== undefined) {
    leasePatch.tenantPhone = patch.tenantPhone;
  }

  const updatedLease = await propertyLongStaysDb.updateLease(lease.id, leasePatch);

  if (membership && PENDING_MEMBERSHIP_STATUSES.has(membership.status)) {
    const membershipPatch: { displayName?: string; inviteEmail?: string } = {};
    if (patch.guestName !== undefined) {
      membershipPatch.displayName = patch.guestName;
    }
    if (patch.tenantEmail !== undefined) {
      membershipPatch.inviteEmail = patch.tenantEmail ?? "";
    }
    if (Object.keys(membershipPatch).length > 0) {
      await leaseTenantMembershipsDb.updatePendingPrimaryContact(membership.id, membershipPatch);
    }
  }

  return updatedLease;
}

export async function updatePrimaryTenantContact(
  lease: IPropertyLongStay,
  patch: TPrimaryTenantContactPatch
): Promise<IPropertyLongStay> {
  if (!hasPrimaryContactPatch(patch)) {
    return lease;
  }

  const membership = await loadPrimaryMembershipForLease(lease.id);
  const tenantUser =
    membership?.tenantUserId != null ? await tenantUsersDb.findById(membership.tenantUserId) : null;
  const resolved = resolvePrimaryTenantContact({
    lease,
    membership,
    tenantUser,
  });

  if (resolved.source === "linked_user" && tenantUser) {
    return updateLinkedPrimaryTenantContact(lease, patch, tenantUser);
  }

  return updateUnlinkedPrimaryTenantContact(lease, patch, membership);
}
