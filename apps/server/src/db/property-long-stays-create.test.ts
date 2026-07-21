import { describe, expect, mock, test } from "bun:test";

import { RentBillingCadence } from "@/packages/shared";
import { buildRentScheduleLeaseRow } from "@/test-fixtures/db-rows";

const capturedSql: string[] = [];

const mockQuery = mock((sql: string) => {
  capturedSql.push(sql);

  if (sql.includes("FROM property_long_stays") && sql.includes("unit_id = $1")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("INSERT INTO property_long_stays")) {
    return Promise.resolve({
      rows: [
        buildRentScheduleLeaseRow({
          id: "lease-weekly-new",
          lease_end_date: "2026-04-14",
          lease_start_date: "2026-01-15",
          rent_amount: "700.00",
          rent_billing_cadence: "weekly",
          term_months: 13,
        }),
      ],
    });
  }

  return Promise.resolve({ rows: [] });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.create", () => {
  test("does not insert rent periods for new weekly leases", async () => {
    capturedSql.length = 0;
    mockQuery.mockClear();

    const created = await propertyLongStaysDb.create("prop-1", {
      guestName: "Tenant",
      leaseStartDate: "2026-01-15",
      rentAmount: 700,
      rentBillingCadence: RentBillingCadence.WEEKLY,
      termMonths: 13,
      unitId: "unit-1",
    });

    expect(created.rentBillingCadence).toBe(RentBillingCadence.WEEKLY);
    expect(
      capturedSql.some((sql) => sql.includes("INSERT INTO property_long_stay_rent_periods"))
    ).toBe(false);
    expect(
      capturedSql.filter((sql) => sql.includes("INSERT INTO property_long_stays"))
    ).toHaveLength(1);
  });
});
