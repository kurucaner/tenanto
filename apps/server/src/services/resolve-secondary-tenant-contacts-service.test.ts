import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseSecondaryTenantContact } from "@/packages/shared";
import { TenantMembershipStatus } from "@/packages/shared";
import { makeLease } from "@/test-fixtures/domain";

const mockLoadSecondaryTenantContactsByLeaseIds = mock(() =>
  Promise.resolve(new Map<string, ILeaseSecondaryTenantContact[]>())
);

mock.module("@/services/load-secondary-tenant-contacts-by-lease-ids", () => ({
  loadSecondaryTenantContactsByLeaseIds: mockLoadSecondaryTenantContactsByLeaseIds,
}));

const { resolveSecondaryTenantContactsForLongStay } =
  await import("./resolve-secondary-tenant-contacts-service");


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

    const contacts = await resolveSecondaryTenantContactsForLongStay(makeLease({ guestName: "Primary", tenantEmail: "primary@example.com" }));

    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.source).toBe("membership_listed");
    expect(mockLoadSecondaryTenantContactsByLeaseIds).toHaveBeenCalledWith(["lease-1"]);
  });

  test("returns empty array when lease has no secondary contacts", async () => {
    mockLoadSecondaryTenantContactsByLeaseIds.mockResolvedValueOnce(new Map());

    const contacts = await resolveSecondaryTenantContactsForLongStay(makeLease({ guestName: "Primary", tenantEmail: "primary@example.com" }));

    expect(contacts).toEqual([]);
  });
});
