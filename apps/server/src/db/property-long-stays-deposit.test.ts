import { describe, expect, mock, test } from "bun:test";

import { buildRentScheduleLeaseRow } from "@/test-fixtures/db-rows";

type TLeaseRow = Record<string, unknown>;

let currentLeaseRow: TLeaseRow;
let insertParams: unknown[] | undefined;
const capturedClientSql: string[] = [];
let updateTermsParams: unknown[] | undefined;

const mockClientQuery = mock((sql: string, params?: unknown[]) => {
  capturedClientSql.push(sql);

  if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("SELECT id") && sql.includes("property_long_stay_rent_periods")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("UPDATE property_long_stays")) {
    updateTermsParams = params;
    currentLeaseRow = buildRentScheduleLeaseRow({
      lease_end_date: params?.[4],
      lease_start_date: params?.[1],
      rent_amount: String(params?.[3]),
      security_deposit_amount:
        params?.[5] === undefined || params?.[5] === null ? null : String(params?.[5]),
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
  if (sql.includes("FROM property_long_stays") && sql.includes("unit_id = $1")) {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("INSERT INTO property_long_stays")) {
    insertParams = params;
    const securityDepositAmount = params?.[11];
    return Promise.resolve({
      rows: [
        buildRentScheduleLeaseRow({
          id: "lease-deposit-new",
          lease_end_date: params?.[6],
          lease_start_date: params?.[3],
          rent_amount: String(params?.[5]),
          security_deposit_amount:
            securityDepositAmount === undefined || securityDepositAmount === null
              ? null
              : String(securityDepositAmount),
          term_months: params?.[4],
          unit_id: params?.[1],
        }),
      ],
    });
  }

  if (sql.includes("WHERE unit_id = $1") && sql.includes("status = $2")) {
    return Promise.resolve({ rows: [] });
  }

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

describe("propertyLongStaysDb security deposit", () => {
  test("create persists securityDepositAmount", async () => {
    insertParams = undefined;
    mockQuery.mockClear();

    const created = await propertyLongStaysDb.create("prop-1", {
      guestName: "Tenant",
      leaseStartDate: "2026-01-01",
      rentAmount: 1500,
      securityDepositAmount: 1500,
      termMonths: 12,
      unitId: "unit-1",
    });

    expect(created.securityDepositAmount).toBe(1500);
    expect(insertParams?.[11]).toBe(1500);
    expect(
      String(mockQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT"))?.[0])
    ).toContain("security_deposit_amount");
  });

  test("create defaults omitted deposit to null", async () => {
    insertParams = undefined;
    mockQuery.mockClear();

    const created = await propertyLongStaysDb.create("prop-1", {
      guestName: "Tenant",
      leaseStartDate: "2026-01-01",
      rentAmount: 1500,
      termMonths: 12,
      unitId: "unit-1",
    });

    expect(created.securityDepositAmount).toBeNull();
    expect(insertParams?.[11]).toBeNull();
  });

  test("updateTerms sets securityDepositAmount when provided", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({ security_deposit_amount: null });
    updateTermsParams = undefined;
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.updateTerms("lease-1", {
      leaseStartDate: "2026-01-01",
      rentAmount: 1500,
      securityDepositAmount: 2000,
      termMonths: 3,
    });

    expect(updated.securityDepositAmount).toBe(2000);
    expect(updateTermsParams?.[5]).toBe(2000);
  });

  test("updateTerms leaves deposit unchanged when omitted", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({ security_deposit_amount: "1800.00" });
    updateTermsParams = undefined;
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.updateTerms("lease-1", {
      leaseStartDate: "2026-01-01",
      rentAmount: 1600,
      termMonths: 3,
    });

    expect(updated.securityDepositAmount).toBe(1800);
    expect(updateTermsParams?.[5]).toBe(1800);
  });

  test("updateTerms clears deposit when null", async () => {
    currentLeaseRow = buildRentScheduleLeaseRow({ security_deposit_amount: "1500.00" });
    updateTermsParams = undefined;
    capturedClientSql.length = 0;
    mockClientQuery.mockClear();

    const updated = await propertyLongStaysDb.updateTerms("lease-1", {
      leaseStartDate: "2026-01-01",
      rentAmount: 1500,
      securityDepositAmount: null,
      termMonths: 3,
    });

    expect(updated.securityDepositAmount).toBeNull();
    expect(updateTermsParams?.[5]).toBeNull();
  });
});
