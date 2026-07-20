import { describe, expect, test } from "bun:test";

import { formatHomePortfolioReportsKpi } from "@/lib/home-portfolio-reports-kpi";
import type { IHomeFinancialOverview } from "@/packages/shared";

function makeOverview(overrides: Partial<IHomeFinancialOverview> = {}): IHomeFinancialOverview {
  return {
    byMonth: [],
    expenseByCategory: [],
    period: { from: "2026-01-01", to: "2026-06-30" },
    propertyCount: 2,
    totals: {
      grossIncome: 10000,
      netIncome: 8000,
      operationalNet: 6500,
      totalExpenses: 3500,
    },
    ...overrides,
  };
}

describe("formatHomePortfolioReportsKpi", () => {
  test("returns operational net summary when portfolio has properties", () => {
    expect(formatHomePortfolioReportsKpi(makeOverview())).toBe(
      "Operational net $6,500.00 · Last 6 months"
    );
  });

  test("returns null when there is no property data", () => {
    expect(formatHomePortfolioReportsKpi(makeOverview({ propertyCount: 0 }))).toBeNull();
  });
});
