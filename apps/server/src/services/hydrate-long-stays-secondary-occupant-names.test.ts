import { beforeEach, describe, expect, mock, test } from "bun:test";

import { makeLongStay } from "@/test-fixtures/domain";

const mockLoadSecondaryOccupancyNamesByLeaseIds = mock(() =>
  Promise.resolve(new Map<string, string[]>())
);

mock.module("@/db/lease-tenant-memberships", () => ({
  loadSecondaryOccupancyNamesByLeaseIds: mockLoadSecondaryOccupancyNamesByLeaseIds,
}));

const { hydrateLongStaysSecondaryOccupantNames } =
  await import("./hydrate-long-stays-secondary-occupant-names");

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

    const [hydrated] = await hydrateLongStaysSecondaryOccupantNames([
      makeLongStay({ guestName: "Primary Tenant", id: "lease-1" }),
    ]);

    expect(hydrated?.secondaryOccupantNames).toEqual(["Secondary One", "Secondary Two"]);
  });

  test("leaves lease unchanged when no secondary names exist", async () => {
    const lease = makeLongStay({ guestName: "Primary Tenant", id: "lease-1" });
    const [hydrated] = await hydrateLongStaysSecondaryOccupantNames([lease]);

    expect(hydrated).toEqual(lease);
    expect(hydrated?.secondaryOccupantNames).toBeUndefined();
  });
});
