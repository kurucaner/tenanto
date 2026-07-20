import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseSecondaryTenantContact, IPropertyLongStay } from "@/packages/shared";
import { PropertyLongStayStatus, TenantMembershipStatus } from "@/packages/shared";
import { makeLease } from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolvedEmpty } from "@/test-fixtures/mocks";

const mockListByProperty = mockResolvedEmpty<IPropertyLongStay>();
const mockLoadSecondaryTenantContactsByLeaseIds = mockAsyncFn(() =>
  Promise.resolve(new Map<string, ILeaseSecondaryTenantContact[]>())
);

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: {
    listByProperty: mockListByProperty,
  },
}));

mock.module("@/services/load-secondary-tenant-contacts-by-lease-ids", () => ({
  loadSecondaryTenantContactsByLeaseIds: mockLoadSecondaryTenantContactsByLeaseIds,
}));

const { buildTenantEmailCampaignPreview } = await import("./tenant-email-campaign-service");

const campaignLease = makeLease({
  guestName: "Primary Tenant",
  id: "lease-1",
  leaseEndDate: "2027-01-01",
  tenantEmail: "primary@example.com",
});

describe("buildTenantEmailCampaignPreview", () => {
  beforeEach(() => {
    mockListByProperty.mockReset();
    mockLoadSecondaryTenantContactsByLeaseIds.mockReset();
    mockListByProperty.mockResolvedValue([]);
    mockLoadSecondaryTenantContactsByLeaseIds.mockResolvedValue(new Map());
  });

  test("loads secondary contacts for active leases before resolving recipients", async () => {
    mockListByProperty.mockResolvedValueOnce([campaignLease]);

    await buildTenantEmailCampaignPreview("property-1");

    expect(mockListByProperty).toHaveBeenCalledWith("property-1", {
      status: PropertyLongStayStatus.ACTIVE,
    });
    expect(mockLoadSecondaryTenantContactsByLeaseIds).toHaveBeenCalledWith(["lease-1"]);
  });

  test("includes secondary recipients from membership contacts", async () => {
    mockListByProperty.mockResolvedValueOnce([campaignLease]);
    mockLoadSecondaryTenantContactsByLeaseIds.mockResolvedValueOnce(
      new Map([
        [
          "lease-1",
          [
            {
              effectiveEmail: "secondary@example.com",
              effectiveName: "Secondary Tenant",
              effectivePhone: null,
              membershipId: "membership-secondary",
              source: "membership_listed",
              status: TenantMembershipStatus.LISTED,
              tenantUserId: null,
            },
          ],
        ],
      ])
    );

    const preview = await buildTenantEmailCampaignPreview("property-1");

    expect(preview.recipientCount).toBe(2);
    expect(preview.recipients).toEqual([
      {
        email: "primary@example.com",
        leaseId: "lease-1",
        tenantName: "Primary Tenant",
        tenantRole: "primary",
      },
      {
        email: "secondary@example.com",
        leaseId: "lease-1",
        tenantName: "Secondary Tenant",
        tenantRole: "secondary",
      },
    ]);
    expect(preview.skipped).toEqual([]);
    expect(preview.skippedCount).toBe(0);
  });

  test("returns primary-only preview when no secondary contacts exist", async () => {
    mockListByProperty.mockResolvedValueOnce([campaignLease]);

    const preview = await buildTenantEmailCampaignPreview("property-1");

    expect(preview.recipientCount).toBe(1);
    expect(preview.recipients).toEqual([
      {
        email: "primary@example.com",
        leaseId: "lease-1",
        tenantName: "Primary Tenant",
        tenantRole: "primary",
      },
    ]);
  });
});
