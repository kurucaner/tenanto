import type { IPropertyLongStay } from "./property-long-stay-types";
import { type TPrimaryTenantContactSource } from "./tenant-contact-source-types";
import { isTerminalTenantMembershipStatus } from "./tenant-membership-transitions";
import {
  type ILeaseTenantMembership,
  type ITenantUser,
  TenantMembershipRole,
  TenantMembershipStatus,
  type TTenantMembershipStatus,
} from "./tenant-portal-types";

export type { TPrimaryTenantContactSource } from "./tenant-contact-source-types";

export interface ILeasePrimaryTenantContact {
  effectiveEmail: string | null;
  effectiveName: string;
  effectivePhone: string | null;
  membershipId: string | null;
  membershipStatus: TTenantMembershipStatus | null;
  source: TPrimaryTenantContactSource;
  tenantUserId: string | null;
}

export type ILeasePrimaryTenantContactLeaseInput = Pick<
  IPropertyLongStay,
  "guestName" | "tenantEmail" | "tenantPhone"
>;

export interface IResolvePrimaryTenantContactInput {
  lease: ILeasePrimaryTenantContactLeaseInput;
  membership: ILeaseTenantMembership | null;
  tenantUser: ITenantUser | null;
}

const PENDING_MEMBERSHIP_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_ACCEPTANCE,
  TenantMembershipStatus.PENDING_INVITE,
]);

function sortMembershipsByRecency(a: ILeaseTenantMembership, b: ILeaseTenantMembership): number {
  return b.invitedAt.localeCompare(a.invitedAt) || b.createdAt.localeCompare(a.createdAt);
}

function leaseFallbackContact(
  lease: ILeasePrimaryTenantContactLeaseInput
): ILeasePrimaryTenantContact {
  return {
    effectiveEmail: lease.tenantEmail,
    effectiveName: lease.guestName,
    effectivePhone: lease.tenantPhone,
    membershipId: null,
    membershipStatus: null,
    source: "lease",
    tenantUserId: null,
  };
}

/**
 * Pick the primary membership row used for effective tenant contact on a lease.
 * Prefers active linked primary, then any active primary, then the latest pending invite.
 * Terminal memberships (ended, revoked, etc.) are ignored.
 */
export function selectPrimaryMembershipForContact(
  memberships: readonly ILeaseTenantMembership[]
): ILeaseTenantMembership | null {
  const primaryMemberships = memberships.filter(
    (membership) => membership.role === TenantMembershipRole.PRIMARY
  );
  if (primaryMemberships.length === 0) {
    return null;
  }

  const activeLinked = primaryMemberships
    .filter(
      (membership) =>
        membership.status === TenantMembershipStatus.ACTIVE && membership.tenantUserId != null
    )
    .sort(sortMembershipsByRecency)[0];
  if (activeLinked) {
    return activeLinked;
  }

  const active = primaryMemberships
    .filter((membership) => membership.status === TenantMembershipStatus.ACTIVE)
    .sort(sortMembershipsByRecency)[0];
  if (active) {
    return active;
  }

  const pending = primaryMemberships
    .filter((membership) => PENDING_MEMBERSHIP_STATUSES.has(membership.status))
    .sort(sortMembershipsByRecency)[0];
  if (pending) {
    return pending;
  }

  return null;
}

/**
 * Resolve the effective primary tenant contact for a lease from lease columns,
 * optional primary membership, and optional linked tenant user.
 */
export function resolvePrimaryTenantContact(
  input: IResolvePrimaryTenantContactInput
): ILeasePrimaryTenantContact {
  const { lease, membership, tenantUser } = input;

  if (!membership || isTerminalTenantMembershipStatus(membership.status)) {
    return leaseFallbackContact(lease);
  }

  const membershipMeta = {
    membershipId: membership.id,
    membershipStatus: membership.status,
    tenantUserId: membership.tenantUserId,
  };

  if (
    membership.status === TenantMembershipStatus.ACTIVE &&
    membership.tenantUserId != null &&
    tenantUser != null &&
    tenantUser.id === membership.tenantUserId
  ) {
    return {
      ...membershipMeta,
      effectiveEmail: tenantUser.email,
      effectiveName: tenantUser.name,
      effectivePhone: tenantUser.phone,
      source: "linked_user",
    };
  }

  if (PENDING_MEMBERSHIP_STATUSES.has(membership.status)) {
    return {
      ...membershipMeta,
      effectiveEmail: membership.inviteEmail,
      effectiveName: membership.displayName.trim() || lease.guestName,
      effectivePhone: lease.tenantPhone,
      source: "membership_pending",
    };
  }

  return leaseFallbackContact(lease);
}
