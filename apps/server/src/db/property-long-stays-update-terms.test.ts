import { describe, expect, mock, test } from "bun:test";

import { LeaseErrorCode } from "@/errors/lease-errors";
import { buildRentScheduleLeaseRow } from "@/test-fixtures/db-rows";

type TLeaseRow = Record<string, unknown>;

let currentLeaseRow: TLeaseRow;
let activeLeaseOnUnit: TLeaseRow | null = null;
let currentRentPeriodRows: Record<string, unknown>[] = [];
const capturedClientSql: string[] = [];

const mockClientQuery = mock((sql: string, params?: unknown[]) => {
  capturedClientSql.push(sql);

  if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("SELECT id") && sql.includes("property_long_stay_rent_periods")) {
    return Promise.resolve({ rows: currentRentPeriodRows });
  }

  if (sql.includes("UPDATE property_long_stay_rent_periods")) {
    currentRentPeriodRows = [
      {
        effective_from_month: params?.[1],
        monthly_rent: String(params?.[2]),
      },
    ];
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("UPDATE property_long_stays")) {
    currentLeaseRow = buildRentScheduleLeaseRow({
      lease_end_date: params?.[4],
      lease_start_date: params?.[1],
      monthly_rent: String(params?.[3]),
      term_months: params?.[2],
    });
    return Promise.resolve({ rows: [currentLeaseRow] });
  }

  return Promise.resolve({ rows: [] });
});

const mockClient = {
  query: mockClientQuery,
  release: mock(() => {}),
};

const mockQuery = mock((sql: string, _params?: unknown[]) => {
  if (sql.includes("FROM property_income_lines")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("FROM tenant_rent_payment_allocations")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("FROM property_long_stay_rent_periods")) {
    return Promise.resolve({ rows: currentRentPeriodRows });
  }

  if (sql.includes("WHERE unit_id = $1") && sql.includes("status = $2")) {
    return Promise.resolve({ rows: activeLeaseOnUnit ? [activeLeaseOnUnit] : [] });
  }

  if (sql.includes("FROM property_long_stays") && sql.includes("WHERE id = $1")) {
    return Promise.resolve({ rows: [currentLeaseRow] });
  }

  if (sql.includes("FROM property_long_stays")) {
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

mock.module("./tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    sumSucceededAllocatedCentsByMonths: () => Promise.resolve(new Map()),
  },
}));

const { propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.updateTerms", () => {
  test("updates lease fields in a transaction", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    activeLeaseOnUnit = null;
    currentRentPeriodRows = [];
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.updateTerms("lease-1", {
      leaseStartDate: "2026-02-01",
      monthlyRent: 1800,
      termMonths: 6,
    });

    expect(updated).toMatchObject({
      leaseEndDate: "2026-08-01",
      leaseStartDate: "2026-02-01",
      monthlyRent: 1800,
      termMonths: 6,
    });
    expect(capturedClientSql[0]).toBe("BEGIN");
    expect(capturedClientSql.at(-1)).toBe("COMMIT");
    expect(capturedClientSql.some((sql) => sql.includes("UPDATE property_long_stays"))).toBe(true);
  });

  test("syncs a single rent period row when present", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentRentPeriodRows = [{ id: "period-1" }];
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    await propertyLongStaysDb.updateTerms("lease-1", {
      leaseStartDate: "2026-02-01",
      monthlyRent: 1800,
      termMonths: 6,
    });

    expect(
      capturedClientSql.some((sql) => sql.includes("UPDATE property_long_stay_rent_periods"))
    ).toBe(true);
    expect(currentRentPeriodRows).toEqual([
      {
        effective_from_month: "2026-02",
        monthly_rent: "1800",
      },
    ]);
  });

  test("getRentSchedule reflects updated dates and rent", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow();
    currentRentPeriodRows = [];
    mockQuery.mockClear();

    await propertyLongStaysDb.updateTerms("lease-1", {
      leaseStartDate: "2026-01-01",
      monthlyRent: 2000,
      termMonths: 2,
    });

    const schedule = await propertyLongStaysDb.getRentSchedule("lease-1", "2026-03-31");

    expect(schedule.map((month) => month.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(schedule.every((month) => month.expectedRent === 2000)).toBe(true);
  });

  test("throws when another active lease exists on the unit and schedule changes", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({ id: "lease-1", unit_id: "unit-1" });
    activeLeaseOnUnit = buildRentScheduleLeaseRow({
      guest_name: "Other Tenant",
      id: "lease-2",
      unit_id: "unit-1",
    });
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    await expect(
      propertyLongStaysDb.updateTerms("lease-1", {
        leaseStartDate: "2026-02-01",
        monthlyRent: 1800,
        termMonths: 6,
      })
    ).rejects.toMatchObject({ code: LeaseErrorCode.ACTIVE_LONG_STAY_CONFLICT });

    expect(capturedClientSql.some((sql) => sql === "BEGIN")).toBe(false);
  });

  test("allows rent-only patch when another active lease row exists for the same lease id", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({ id: "lease-1", unit_id: "unit-1" });
    activeLeaseOnUnit = buildRentScheduleLeaseRow({ id: "lease-1", unit_id: "unit-1" });
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.updateTerms("lease-1", {
      leaseStartDate: "2026-01-01",
      monthlyRent: 1750,
      termMonths: 3,
    });

    expect(updated.monthlyRent).toBe(1750);
    expect(capturedClientSql.some((sql) => sql === "COMMIT")).toBe(true);
  });

  test("skips unit conflict check for rent-only patch", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({ id: "lease-1", unit_id: "unit-1" });
    activeLeaseOnUnit = buildRentScheduleLeaseRow({
      guest_name: "Other Tenant",
      id: "lease-2",
      unit_id: "unit-1",
    });
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.updateTerms("lease-1", {
      leaseStartDate: "2026-01-01",
      monthlyRent: 1600,
      termMonths: 3,
    });

    expect(updated.monthlyRent).toBe(1600);
    expect(capturedClientSql.some((sql) => sql === "COMMIT")).toBe(true);
  });

  test("persists a custom contract end date and derived term months", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({
      lease_end_date: "2027-07-01",
      lease_start_date: "2026-07-01",
      term_months: 12,
    });
    activeLeaseOnUnit = null;
    currentRentPeriodRows = [];
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.updateTerms("lease-1", {
      leaseEndDate: "2027-06-30",
      leaseStartDate: "2026-07-01",
      monthlyRent: 1500,
    });

    expect(updated).toMatchObject({
      leaseEndDate: "2027-06-30",
      leaseStartDate: "2026-07-01",
      termMonths: 12,
    });
  });
});
