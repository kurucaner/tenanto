import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  LeaseDepositBalanceStatus,
  SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
} from "@/packages/shared";
import { makeLease } from "@/test-fixtures/domain";
import { mockAsyncFn } from "@/test-fixtures/mocks";

const mockQuery = mockAsyncFn((_sql: string, _params?: unknown[]) =>
  Promise.resolve({ rows: [] as Record<string, unknown>[] })
);

mock.module("@/db/pool", () => ({
  pool: { query: mockQuery },
}));

/** Full DB-shaped rows so the real `mapPropertyIncomeLineRow` can run (no mappers mock). */
function buildDepositIncomeLineRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    amount: 1500,
    channel_commission: 0,
    created_at: new Date("2026-01-15T00:00:00.000Z"),
    deleted_at: null,
    description: null,
    gross_income: 1500,
    guest_name: null,
    id: "line-1",
    income_line_type_id: "type-deposit",
    income_line_type_name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
    is_deleted: false,
    long_stay_id: "lease-1",
    net_income: 1500,
    property_id: "property-1",
    refunded_amount: null,
    refunded_at: null,
    refunded_by: null,
    rent_period_key: null,
    reservation_id: null,
    tax_breakdown: [],
    tenant_rent_payment_id: null,
    transaction_date: "2026-01-15",
    unit_id: "unit-1",
    updated_at: new Date("2026-01-15T00:00:00.000Z"),
    ...overrides,
  };
}

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

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("pil.long_stay_id = $2"), [
      "property-1",
      "lease-1",
    ]);
    expect(summary).toEqual({
      collected: 0,
      expected: 1500,
      outstanding: 1500,
      status: LeaseDepositBalanceStatus.DUE,
    });
  });

  test("aggregates deposit lines into held summary", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [buildDepositIncomeLineRow()],
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
        buildDepositIncomeLineRow({
          refunded_amount: 1500,
          refunded_at: new Date("2026-07-01T00:00:00.000Z"),
        }),
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
