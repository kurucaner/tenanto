import { describe, expect, mock, test } from "bun:test";

import { PropertyLongStayStatus } from "@/packages/shared";

const capturedIncomeSql: string[] = [];

const mockQuery = mock((sql: string) => {
  if (sql.includes("FROM property_income_lines")) {
    capturedIncomeSql.push(sql);
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("FROM property_long_stay_rent_periods")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("FROM property_long_stays")) {
    return Promise.resolve({
      rows: [
        {
          actual_end_date: null,
          created_at: new Date("2026-01-01T00:00:00.000Z"),
          guest_name: "Tenant",
          id: "lease-1",
          lease_end_date: "2026-03-31",
          lease_start_date: "2026-01-01",
          monthly_rent: "1500.00",
          property_id: "prop-1",
          secondary_tenants: [],
          status: PropertyLongStayStatus.ACTIVE,
          tenant_email: null,
          tenant_phone: null,
          term_months: 3,
          unit_id: "unit-1",
          updated_at: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
  }

  return Promise.resolve({ rows: [] });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.getRentSchedule", () => {
  test("ignores refunded income lines when determining paid months", async () => {
    capturedIncomeSql.length = 0;
    mockQuery.mockClear();

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1");

    expect(capturedIncomeSql).toHaveLength(1);
    expect(capturedIncomeSql[0]).toContain("refunded_at IS NULL");
    expect(schedule.every((month) => month.isPaid === false)).toBe(true);
  });
});
