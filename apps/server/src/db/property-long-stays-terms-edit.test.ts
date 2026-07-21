import { describe, expect, mock, test } from "bun:test";

const mockQuery = mock((sql: string) => {
  if (sql.includes("has_income_lines")) {
    return Promise.resolve({
      rows: [
        {
          has_income_lines: true,
          has_succeeded_payments: false,
          lease_start_date: "2026-07-09",
          rent_billing_cadence: "monthly",
        },
      ],
    });
  }

  if (sql.includes("property_long_stay_rent_periods")) {
    return Promise.resolve({
      rows: [
        { effective_from_month: "2026-07", monthly_rent: "1500" },
        { effective_from_month: "2027-07", monthly_rent: "1700" },
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

  test("queries income and payment signals and derives rent period history from shared helper", async () => {
    mockQuery.mockClear();

    const result = await propertyLongStaysDb.getTermsEditSignals(
      "11111111-1111-4111-8111-111111111111"
    );

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const signalsSql = String(mockQuery.mock.calls[0]?.[0]);
    expect(signalsSql).toContain("property_income_lines");
    expect(signalsSql).toContain("pil.is_deleted = false");
    expect(signalsSql).toContain("tenant_rent_payments");
    expect(signalsSql).toContain("'succeeded'::tenant_rent_payment_status");
    expect(signalsSql).toContain("rent_billing_cadence");
    expect(signalsSql).not.toContain("property_long_stay_rent_periods");

    const periodsSql = String(mockQuery.mock.calls[1]?.[0]);
    expect(periodsSql).toContain("property_long_stay_rent_periods");

    expect(result).toEqual({
      leaseStartDate: "2026-07-09",
      signals: {
        hasIncomeLines: true,
        hasRentPeriodHistory: true,
        hasSucceededPayments: false,
      },
    });
  });

  test("returns hasRentPeriodHistory false for weekly lease with no rent periods", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("has_income_lines")) {
        return Promise.resolve({
          rows: [
            {
              has_income_lines: false,
              has_succeeded_payments: false,
              lease_start_date: "2026-01-15",
              rent_billing_cadence: "weekly",
            },
          ],
        });
      }

      if (sql.includes("property_long_stay_rent_periods")) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const result = await propertyLongStaysDb.getTermsEditSignals(
      "22222222-2222-4222-8222-222222222222"
    );

    expect(result).toEqual({
      leaseStartDate: "2026-01-15",
      signals: {
        hasIncomeLines: false,
        hasRentPeriodHistory: false,
        hasSucceededPayments: false,
      },
    });
  });
});
