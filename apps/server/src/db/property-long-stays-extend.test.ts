import { describe, expect, mock, test } from "bun:test";

import { buildRentScheduleLeaseRow } from "@/test-fixtures/db-rows";

type TLeaseRow = Record<string, unknown>;

let currentLeaseRow: TLeaseRow;
let currentRentPeriodRows: Record<string, unknown>[] = [];
const capturedClientSql: string[] = [];
const capturedRentPeriodInserts: Array<{ effective_from_month: unknown; monthly_rent: unknown }> =
  [];

const mockClientQuery = mock((sql: string, params?: unknown[]) => {
  capturedClientSql.push(sql);

  if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("SELECT id FROM property_long_stay_rent_periods")) {
    return Promise.resolve({ rows: currentRentPeriodRows });
  }

  if (sql.includes("INSERT INTO property_long_stay_rent_periods")) {
    const row = {
      effective_from_month: params?.[1],
      monthly_rent: String(params?.[2]),
    };
    currentRentPeriodRows = [...currentRentPeriodRows, row];
    capturedRentPeriodInserts.push(row);
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("FROM property_long_stay_rent_periods")) {
    return Promise.resolve({ rows: currentRentPeriodRows });
  }

  if (sql.includes("UPDATE property_long_stays")) {
    currentLeaseRow = buildRentScheduleLeaseRow({
      lease_end_date: params?.[2],
      monthly_rent: String(params?.[3]),
      term_months: params?.[1],
    });
    return Promise.resolve({ rows: [currentLeaseRow] });
  }

  return Promise.resolve({ rows: [] });
});

const mockClient = {
  query: mockClientQuery,
  release: mock(() => {}),
};

const mockQuery = mock((sql: string) => {
  if (sql.includes("FROM property_long_stays") && sql.includes("WHERE id = $1")) {
    return Promise.resolve({ rows: [currentLeaseRow] });
  }

  return Promise.resolve({ rows: [] });
});

mock.module("./pool", () => ({
  pool: {
    connect: () => Promise.resolve(mockClient),
    query: mockQuery,
  },
}));

const { propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.extendLease", () => {
  test("extends by additional months from the current contract end", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      lease_end_date: "2027-06-30",
      lease_start_date: "2026-07-01",
      term_months: 12,
    });
    currentRentPeriodRows = [];
    capturedClientSql.length = 0;
    capturedRentPeriodInserts.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.extendLease("lease-1", {
      additionalTermMonths: 6,
    });

    expect(updated).toMatchObject({
      leaseEndDate: "2027-12-31",
      termMonths: 18,
    });
  });

  test("extends to a custom new end date", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      lease_end_date: "2027-06-30",
      lease_start_date: "2026-07-01",
      term_months: 12,
    });
    currentRentPeriodRows = [];
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.extendLease("lease-1", {
      newLeaseEndDate: "2028-01-15",
    });

    expect(updated.leaseEndDate).toBe("2028-01-15");
    expect(updated.termMonths).toBeGreaterThan(12);
  });

  test("extends weekly lease by additional weeks", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      lease_end_date: "2026-01-07",
      lease_start_date: "2026-01-01",
      rent_billing_cadence: "weekly",
      term_months: 1,
    });
    currentRentPeriodRows = [];
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.extendLease("lease-1", {
      additionalWeeks: 4,
    });

    expect(updated).toMatchObject({
      leaseEndDate: "2026-02-04",
      termMonths: 2,
    });
  });

  test("extends weekly lease with rent change and week-start bootstrap row", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      lease_end_date: "2026-01-07",
      lease_start_date: "2026-01-01",
      monthly_rent: "500.00",
      rent_billing_cadence: "weekly",
      term_months: 1,
    });
    currentRentPeriodRows = [];
    capturedRentPeriodInserts.length = 0;
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.extendLease("lease-1", {
      additionalWeeks: 4,
      newMonthlyRent: 600,
      rentEffectiveFromMonth: "2026-01-15",
    });

    expect(updated).toMatchObject({
      leaseEndDate: "2026-02-04",
      monthlyRent: 600,
    });
    expect(capturedRentPeriodInserts).toEqual([
      { effective_from_month: "2026-01-01", monthly_rent: "500" },
      { effective_from_month: "2026-01-15", monthly_rent: "600" },
    ]);
  });
});
