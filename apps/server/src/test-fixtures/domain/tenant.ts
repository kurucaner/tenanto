import {
  type ILeaseTenantMembership,
  type ITenantUser,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "@/packages/shared";

export function makeTenantUser(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "jane@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Jane Tenant",
    phone: null,
    phoneVerifiedAt: null,
    smsConsentedAt: null,
    smsOptedOutAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Alias used in portal tests. */
export const makeTenant = makeTenantUser;

export function makeLeaseTenantMembership(
  overrides: Partial<ILeaseTenantMembership> = {}
): ILeaseTenantMembership {
  return {
    acceptedAt: null,
    contactPhone: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Jane Tenant",
    endedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "jane@example.com",
    leaseId: "lease-1",
    revokedAt: null,
    role: TenantMembershipRole.PRIMARY,
    status: TenantMembershipStatus.PENDING_INVITE,
    tenantUserId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Alias used in portal tests. */
export const makeMembership = makeLeaseTenantMembership;

export function makeListedMembership(
  overrides: Partial<ILeaseTenantMembership> = {}
): ILeaseTenantMembership {
  return makeLeaseTenantMembership({
    contactPhone: "+15551112222",
    displayName: "Listed Secondary",
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-listed",
    inviteEmail: "listed@example.com",
    role: TenantMembershipRole.SECONDARY,
    status: TenantMembershipStatus.LISTED,
    ...overrides,
  });
}
