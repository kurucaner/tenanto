import { describe, expect, mock, test } from "bun:test";

import { TenantRentPaymentStatus } from "@/packages/shared";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

const mockPoolQuery = mock((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });
  if (sql.includes("GROUP BY a.period_month")) {
    return Promise.resolve({
      rows: [{ month: "2026-01", total: 150_000 }],
    });
  }
  return Promise.resolve({ rows: [{ total: 150_000 }] });
});

mock.module("./pool", () => ({
  pool: { query: mockPoolQuery },
}));

const { tenantRentPaymentsDb } = await import("./tenant-rent-payments");

describe("tenantRentPaymentsDb allocation rollup", () => {
  test("sumSucceededAllocatedCents only counts succeeded payments", async () => {
    capturedQueries.length = 0;
    mockPoolQuery.mockClear();

    const total = await tenantRentPaymentsDb.sumSucceededAllocatedCents("lease-1", "2026-01");

    expect(total).toBe(150_000);
    expect(capturedQueries[0]?.sql).toContain("p.status = $3");
    expect(capturedQueries[0]?.values).toEqual([
      "lease-1",
      "2026-01",
      TenantRentPaymentStatus.SUCCEEDED,
    ]);
  });

  test("sumSucceededAllocatedCentsByMonths only counts succeeded payments", async () => {
    capturedQueries.length = 0;
    mockPoolQuery.mockClear();

    const totals = await tenantRentPaymentsDb.sumSucceededAllocatedCentsByMonths("lease-1", [
      "2026-01",
      "2026-02",
    ]);

    expect(totals.get("2026-01")).toBe(150_000);
    expect(totals.get("2026-02")).toBe(0);
    expect(capturedQueries[0]?.sql).toContain("p.status = $3");
    expect(capturedQueries[0]?.values).toEqual([
      "lease-1",
      ["2026-01", "2026-02"],
      TenantRentPaymentStatus.SUCCEEDED,
    ]);
  });
});
