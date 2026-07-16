import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership, IPropertyLongStay, ITenantUser } from "@/packages/shared";
import {
  PropertyLongStayStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "@/packages/shared";

const mockLoadPrimaryMembershipForLease = mock((): Promise<ILeaseTenantMembership | null> =>
  Promise.resolve(null)
);
const mockFindTenantById = mock((): Promise<ITenantUser | null> => Promise.resolve(null));

mock.module("@/db/lease-tenant-memberships", () => ({
  loadPrimaryMembershipForLease: mockLoadPrimaryMembershipForLease,
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: { findById: mockFindTenantById },
}));

const { resolvePrimaryTenantContactForLongStay } =
  await import("./lease-primary-tenant-contact-service");

function makeLease(overrides: Partial<IPropertyLongStay> = {}): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Lease Primary",
    id: "lease-1",
    leaseEndDate: "2027-01-01",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "property-1",
    secondaryTenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenantEmail: "lease@example.com",
    tenantPhone: "+15551234567",
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: "2026-01-02T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Lease Primary",
    endedAt: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "lease@example.com",
    leaseId: "lease-1",
    revokedAt: null,
    role: TenantMembershipRole.PRIMARY,
    status: TenantMembershipStatus.ACTIVE,
    tenantUserId: "tenant-user-1",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function makeTenantUser(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "linked@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-user-1",
    name: "Linked Tenant",
    phone: "+15559876543",
    phoneVerifiedAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolvePrimaryTenantContactForLongStay", () => {
  beforeEach(() => {
    mockLoadPrimaryMembershipForLease.mockReset();
    mockFindTenantById.mockReset();
  });

  test("returns lease fallback when no primary membership exists", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(null);

    await expect(resolvePrimaryTenantContactForLongStay(makeLease())).resolves.toEqual({
      effectiveEmail: "lease@example.com",
      effectiveName: "Lease Primary",
      effectivePhone: "+15551234567",
      membershipId: null,
      membershipStatus: null,
      source: "lease",
      tenantUserId: null,
    });
    expect(mockFindTenantById).not.toHaveBeenCalled();
  });

  test("returns linked tenant user contact after invite accept", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(makeMembership());
    mockFindTenantById.mockResolvedValue(makeTenantUser());

    await expect(resolvePrimaryTenantContactForLongStay(makeLease())).resolves.toEqual({
      effectiveEmail: "linked@example.com",
      effectiveName: "Linked Tenant",
      effectivePhone: "+15559876543",
      membershipId: "membership-1",
      membershipStatus: TenantMembershipStatus.ACTIVE,
      source: "linked_user",
      tenantUserId: "tenant-user-1",
    });
    expect(mockFindTenantById).toHaveBeenCalledWith("tenant-user-1");
  });
});
