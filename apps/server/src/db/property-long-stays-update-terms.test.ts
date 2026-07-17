import { describe, expect, mock, test } from "bun:test";

import { PropertyLongStayStatus } from "@/packages/shared";

type TLeaseRow = Record<string, unknown>;

let currentLeaseRow: TLeaseRow;
let activeLeaseOnUnit: TLeaseRow | null = null;
let currentRentPeriodRows: Record<string, unknown>[] = [];
const capturedClientSql: string[] = [];

function buildLeaseRow(overrides: Record<string, unknown> = {}): TLeaseRow {
  return {
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
    ...overrides,
  };
}

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
    currentLeaseRow = buildLeaseRow({
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

const mockQuery = mock((sql: string, params?: unknown[]) => {
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

const { ActiveLongStayConflictError, propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.updateTerms", () => {
  test("updates lease fields in a transaction", async () => {
    currentLeaseRow = buildLeaseRow();
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
    currentLeaseRow = buildLeaseRow();
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
    currentLeaseRow = buildLeaseRow();
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
    currentLeaseRow = buildLeaseRow({ id: "lease-1", unit_id: "unit-1" });
    activeLeaseOnUnit = buildLeaseRow({
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
    ).rejects.toBeInstanceOf(ActiveLongStayConflictError);

    expect(capturedClientSql.some((sql) => sql === "BEGIN")).toBe(false);
  });

  test("allows rent-only patch when another active lease row exists for the same lease id", async () => {
    currentLeaseRow = buildLeaseRow({ id: "lease-1", unit_id: "unit-1" });
    activeLeaseOnUnit = buildLeaseRow({ id: "lease-1", unit_id: "unit-1" });
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
    currentLeaseRow = buildLeaseRow({ id: "lease-1", unit_id: "unit-1" });
    activeLeaseOnUnit = buildLeaseRow({
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
});
