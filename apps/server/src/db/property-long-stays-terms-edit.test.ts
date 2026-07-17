import { describe, expect, mock, test } from "bun:test";

const mockQuery = mock((sql: string) => {
  if (sql.includes("has_income_lines")) {
    return Promise.resolve({
      rows: [
        {
          has_income_lines: true,
          has_rent_period_history: false,
          has_succeeded_payments: false,
          lease_start_date: "2026-07-09",
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

describe("propertyLongStaysDb.getTermsEditSignals", () => {
  test("returns null when lease is missing", async () => {
    mockQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }));

    const result = await propertyLongStaysDb.getTermsEditSignals(
      "11111111-1111-4111-8111-111111111111"
    );

    expect(result).toBeNull();
  });

  test("queries income lines, succeeded payments, and rent period history", async () => {
    mockQuery.mockClear();

    const result = await propertyLongStaysDb.getTermsEditSignals(
      "11111111-1111-4111-8111-111111111111"
    );

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = String(mockQuery.mock.calls[0]?.[0]);
    expect(sql).toContain("property_income_lines");
    expect(sql).toContain("pil.is_deleted = false");
    expect(sql).toContain("tenant_rent_payments");
    expect(sql).toContain("'succeeded'::tenant_rent_payment_status");
    expect(sql).toContain("property_long_stay_rent_periods");
    expect(sql).toContain("effective_from_month <> to_char(pls.lease_start_date, 'YYYY-MM')");

    expect(result).toEqual({
      leaseStartDate: "2026-07-09",
      signals: {
        hasIncomeLines: true,
        hasRentPeriodHistory: false,
        hasSucceededPayments: false,
      },
    });
  });
});
