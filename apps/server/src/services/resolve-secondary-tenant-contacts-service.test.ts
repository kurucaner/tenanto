import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type {
  ILeaseSecondaryTenantContact,
  ILeaseTenantMembership,
  IPropertyLongStay,
  ITenantUser,
} from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";

const mockLoadSecondaryMembershipsByLeaseIds = mock(() =>
  Promise.resolve(new Map<string, ILeaseTenantMembership[]>())
);
const mockLoadSecondaryTenantContactsByLeaseIds = mock(() =>
  Promise.resolve(new Map<string, ILeaseSecondaryTenantContact[]>())
);
const mockFindTenantUserById = mock(() => Promise.resolve(null as ITenantUser | null));

mock.module("@/db/lease-tenant-memberships", () => ({
  loadSecondaryMembershipsByLeaseIds: mockLoadSecondaryMembershipsByLeaseIds,
}));

mock.module("@/services/load-secondary-tenant-contacts-by-lease-ids", () => ({
  loadSecondaryTenantContactsByLeaseIds: mockLoadSecondaryTenantContactsByLeaseIds,
  loadTenantUsersByIdForMemberships: mock(async () => ({})),
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findById: mockFindTenantUserById,
  },
}));

const { resolveSecondaryTenantContactsForLongStay } =
  await import("./resolve-secondary-tenant-contacts-service");

function makeLease(overrides: Partial<IPropertyLongStay> = {}): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Primary",
    id: "lease-1",
    leaseEndDate: "2026-12-31",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "property-1",
    secondaryTenants: [],
    status: "active",
    tenantEmail: "primary@example.com",
    tenantPhone: null,
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveSecondaryTenantContactsForLongStay", () => {
  beforeEach(() => {
    mockLoadSecondaryMembershipsByLeaseIds.mockReset();
    mockLoadSecondaryTenantContactsByLeaseIds.mockReset();
    mockFindTenantUserById.mockReset();
  });

  afterEach(() => {
    mockLoadSecondaryMembershipsByLeaseIds.mockReset();
    mockLoadSecondaryTenantContactsByLeaseIds.mockReset();
    mockFindTenantUserById.mockReset();
  });

  test("uses batch loader when lease has no legacy JSONB secondaries", async () => {
    mockLoadSecondaryTenantContactsByLeaseIds.mockResolvedValueOnce(
      new Map([
        [
          "lease-1",
          [
            {
              effectiveEmail: "listed@example.com",
              effectiveName: "Listed Secondary",
              effectivePhone: "+15551112222",
              membershipId: "membership-listed",
              source: "membership_listed",
              status: TenantMembershipStatus.LISTED,
              tenantUserId: null,
            },
          ],
        ],
      ])
    );

    const contacts = await resolveSecondaryTenantContactsForLongStay(makeLease());

    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.source).toBe("membership_listed");
    expect(mockLoadSecondaryTenantContactsByLeaseIds).toHaveBeenCalledWith(["lease-1"]);
    expect(mockLoadSecondaryMembershipsByLeaseIds).not.toHaveBeenCalled();
  });

  test("merges listed memberships with unmatched legacy JSONB orphans", async () => {
    mockLoadSecondaryMembershipsByLeaseIds.mockResolvedValueOnce(
      new Map([
        [
          "lease-1",
          [
            {
              acceptedAt: null,
              contactPhone: "+15551112222",
              createdAt: "2026-01-01T00:00:00.000Z",
              declinedAt: null,
              displayName: "Listed Secondary",
              endedAt: null,
              expiresAt: "2026-02-01T00:00:00.000Z",
              id: "membership-listed",
              invitedAt: "2026-01-01T00:00:00.000Z",
              invitedBy: "operator-1",
              inviteEmail: "listed@example.com",
              leaseId: "lease-1",
              revokedAt: null,
              role: TenantMembershipRole.SECONDARY,
              status: TenantMembershipStatus.LISTED,
              tenantUserId: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        ],
      ])
    );

    const contacts = await resolveSecondaryTenantContactsForLongStay(
      makeLease({
        secondaryTenants: [
          {
            email: "legacy@example.com",
            name: "Legacy Secondary",
            phone: "+15556667777",
          },
        ],
      })
    );

    expect(contacts).toHaveLength(2);
    expect(contacts[0]?.source).toBe("membership_listed");
    expect(contacts[1]?.source).toBe("legacy_jsonb");
    expect(contacts[1]?.membershipId).toBeNull();
    expect(mockLoadSecondaryTenantContactsByLeaseIds).not.toHaveBeenCalled();
  });
});
