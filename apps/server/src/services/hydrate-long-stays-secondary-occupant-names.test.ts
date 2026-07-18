import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyLongStay } from "@/packages/shared";
import { PropertyLongStayStatus } from "@/packages/shared";

const mockLoadSecondaryOccupancyNamesByLeaseIds = mock(() =>
  Promise.resolve(new Map<string, string[]>())
);

mock.module("@/db/lease-tenant-memberships", () => ({
  loadSecondaryOccupancyNamesByLeaseIds: mockLoadSecondaryOccupancyNamesByLeaseIds,
}));

const { hydrateLongStaysSecondaryOccupantNames } = await import(
  "./hydrate-long-stays-secondary-occupant-names"
);

function makeLease(id: string): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Primary Tenant",
    id,
    leaseEndDate: "2027-01-01",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "property-1",
    secondaryTenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenantEmail: null,
    tenantPhone: null,
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("hydrateLongStaysSecondaryOccupantNames", () => {
  beforeEach(() => {
    mockLoadSecondaryOccupancyNamesByLeaseIds.mockReset();
    mockLoadSecondaryOccupancyNamesByLeaseIds.mockResolvedValue(new Map());
  });

  test("returns empty array unchanged", async () => {
    await expect(hydrateLongStaysSecondaryOccupantNames([])).resolves.toEqual([]);
    expect(mockLoadSecondaryOccupancyNamesByLeaseIds).not.toHaveBeenCalled();
  });

  test("attaches secondaryOccupantNames when memberships exist", async () => {
    mockLoadSecondaryOccupancyNamesByLeaseIds.mockResolvedValueOnce(
      new Map([["lease-1", ["Secondary One", "Secondary Two"]]])
    );

    const [hydrated] = await hydrateLongStaysSecondaryOccupantNames([makeLease("lease-1")]);

    expect(hydrated?.secondaryOccupantNames).toEqual(["Secondary One", "Secondary Two"]);
  });

  test("leaves lease unchanged when no secondary names exist", async () => {
    const lease = makeLease("lease-1");
    const [hydrated] = await hydrateLongStaysSecondaryOccupantNames([lease]);

    expect(hydrated).toEqual(lease);
    expect(hydrated?.secondaryOccupantNames).toBeUndefined();
  });
});
