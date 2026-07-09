import { describe, expect, test } from "bun:test";

import { getExpenseBreakdownChartHeight } from "./report-chart-layout";

describe("getExpenseBreakdownChartHeight", () => {
  test("returns min height for empty or small category sets", () => {
    expect(getExpenseBreakdownChartHeight(0)).toBe(280);
    expect(getExpenseBreakdownChartHeight(3)).toBe(280);
  });

  test("scales height with category count", () => {
    expect(getExpenseBreakdownChartHeight(8)).toBe(288);
  });

  test("caps height at max for large category sets", () => {
    expect(getExpenseBreakdownChartHeight(16)).toBe(560);
    expect(getExpenseBreakdownChartHeight(24)).toBe(560);
  });
});
