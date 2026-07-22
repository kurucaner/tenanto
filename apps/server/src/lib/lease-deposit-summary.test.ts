import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LeaseDepositBalanceStatus, SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME } from "@/packages/shared";
import { makeIncomeLine, makeLease } from "@/test-fixtures/domain";
import { mockAsyncFn } from "@/test-fixtures/mocks";

const mockQuery = mockAsyncFn((_sql: string, _params?: unknown[]) =>
  Promise.resolve({ rows: [] as Record<string, unknown>[] })
);

mock.module("@/db/pool", () => ({
  pool: { query: mockQuery },
}));

mock.module("@/db/mappers", () => ({
  mapPropertyIncomeLineRow: (row: Record<string, unknown>) =>
    makeIncomeLine({
      amount: Number(row["amount"]),
      id: String(row["id"]),
      incomeLineTypeName: String(row["income_line_type_name"]),
      longStayId: String(row["long_stay_id"]),
      propertyId: String(row["property_id"]),
      refundedAmount:
        row["refunded_amount"] == null ? null : Number(row["refunded_amount"]),
      refundedAt: (row["refunded_at"] as string | null) ?? null,
    }),
}));

const { loadLeaseDepositSummary } = await import("./lease-deposit-summary");

describe("loadLeaseDepositSummary", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  test("returns due when lease has expected deposit and no deposit lines", async () => {
    const summary = await loadLeaseDepositSummary(
      makeLease({
        id: "lease-1",
        propertyId: "property-1",
        securityDepositAmount: 1500,
      })
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("pil.long_stay_id = $2"),
      ["property-1", "lease-1"]
    );
    expect(summary).toEqual({
      collected: 0,
      expected: 1500,
      outstanding: 1500,
      status: LeaseDepositBalanceStatus.DUE,
    });
  });

  test("aggregates deposit lines into held summary", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          amount: 1500,
          id: "line-1",
          income_line_type_name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
          long_stay_id: "lease-1",
          property_id: "property-1",
          refunded_amount: null,
          refunded_at: null,
        },
      ],
    });

    const summary = await loadLeaseDepositSummary(
      makeLease({
        id: "lease-1",
        propertyId: "property-1",
        securityDepositAmount: 1500,
      })
    );

    expect(summary).toEqual({
      collected: 1500,
      expected: 1500,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.HELD,
    });
  });

  test("returns refunded when a deposit line has been refunded", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          amount: 1500,
          id: "line-1",
          income_line_type_name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
          long_stay_id: "lease-1",
          property_id: "property-1",
          refunded_amount: 1500,
          refunded_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    });

    const summary = await loadLeaseDepositSummary(
      makeLease({
        id: "lease-1",
        propertyId: "property-1",
        securityDepositAmount: 1500,
      })
    );

    expect(summary.status).toBe(LeaseDepositBalanceStatus.REFUNDED);
    expect(summary.collected).toBe(1500);
  });

  test("returns none when no expected deposit and no lines", async () => {
    const summary = await loadLeaseDepositSummary(
      makeLease({
        id: "lease-1",
        propertyId: "property-1",
        securityDepositAmount: null,
      })
    );

    expect(summary).toEqual({
      collected: 0,
      expected: null,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.NONE,
    });
  });
});
