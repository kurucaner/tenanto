import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseSecondaryTenantContact, IPropertyLongStay } from "@/packages/shared";
import { TenantMembershipStatus } from "@/packages/shared";

const mockLoadSecondaryTenantContactsByLeaseIds = mock(() =>
  Promise.resolve(new Map<string, ILeaseSecondaryTenantContact[]>())
);

mock.module("@/services/load-secondary-tenant-contacts-by-lease-ids", () => ({
  loadSecondaryTenantContactsByLeaseIds: mockLoadSecondaryTenantContactsByLeaseIds,
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
    mockLoadSecondaryTenantContactsByLeaseIds.mockReset();
  });

  afterEach(() => {
    mockLoadSecondaryTenantContactsByLeaseIds.mockReset();
  });

  test("delegates to batch loader for lease contacts", async () => {
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
  });

  test("returns empty array when lease has no secondary contacts", async () => {
    mockLoadSecondaryTenantContactsByLeaseIds.mockResolvedValueOnce(new Map());

    const contacts = await resolveSecondaryTenantContactsForLongStay(makeLease());

    expect(contacts).toEqual([]);
  });
});
