import { describe, expect, mock, test } from "bun:test";

import { PropertyLongStayStatus } from "@/packages/shared";

const mockQuery = mock(() =>
  Promise.resolve({
    rows: [
      {
        actual_end_date: null,
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        guest_name: "Tenant A",
        id: "11111111-1111-4111-8111-111111111111",
        lease_end_date: "2027-07-09",
        lease_start_date: "2026-07-09",
        monthly_rent: "1500.00",
        property_id: "prop-1",
        secondary_tenants: [],
        status: PropertyLongStayStatus.ACTIVE,
        tenant_email: null,
        tenant_phone: null,
        term_months: 12,
        unit_id: "unit-1",
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
      {
        actual_end_date: "2026-06-30",
        created_at: new Date("2026-06-01T10:00:00.000Z"),
        guest_name: "Tenant B",
        id: "22222222-2222-4222-8222-222222222222",
        lease_end_date: "2026-06-30",
        lease_start_date: "2026-01-01",
        monthly_rent: "1200.00",
        property_id: "prop-1",
        secondary_tenants: [],
        status: PropertyLongStayStatus.ENDED,
        tenant_email: null,
        tenant_phone: null,
        term_months: 6,
        unit_id: "unit-2",
        updated_at: new Date("2026-06-30T10:00:00.000Z"),
      },
      {
        actual_end_date: null,
        created_at: new Date("2025-12-01T10:00:00.000Z"),
        guest_name: "Tenant C",
        id: "33333333-3333-4333-8333-333333333333",
        lease_end_date: "2026-05-31",
        lease_start_date: "2025-12-01",
        monthly_rent: "1100.00",
        property_id: "prop-1",
        secondary_tenants: [],
        status: PropertyLongStayStatus.ENDED,
        tenant_email: null,
        tenant_phone: null,
        term_months: 6,
        unit_id: "unit-3",
        updated_at: new Date("2026-05-31T10:00:00.000Z"),
      },
    ],
  })
);

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyLongStaysDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });

    expect(firstPage.longStays).toHaveLength(2);
    expect(firstPage.longStays[0]?.leaseStartDate).toBe("2026-07-09");
    expect(firstPage.longStays[1]?.leaseStartDate).toBe("2026-01-01");
    expect(firstPage.nextCursor).toBeString();

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("lease_start_date DESC");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyLongStaysDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyLongStaysDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("(lease_start_date, created_at, id) <");
  });
});
