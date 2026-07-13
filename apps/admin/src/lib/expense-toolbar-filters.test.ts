import { describe, expect, test } from "bun:test";

import { DateRangePreset } from "@/lib/date-range-presets";

import {
  buildExpenseToolbarClearAllPatch,
  buildExpenseToolbarClearOnePatch,
  buildExpenseToolbarFilterItems,
  countExpenseSecondaryFilters,
} from "./expense-toolbar-filters";

const OPTIONS = {
  categoryOptions: [{ label: "Utilities", value: "category-1" }],
};

describe("countExpenseSecondaryFilters", () => {
  test("counts only populated secondary filters", () => {
    expect(countExpenseSecondaryFilters({ categoryId: "category-1" })).toBe(1);
    expect(countExpenseSecondaryFilters({ categoryId: "" })).toBe(0);
  });
});

describe("buildExpenseToolbarFilterItems", () => {
  test("omits the default month and resolves category label", () => {
    expect(
      buildExpenseToolbarFilterItems({
        activePreset: DateRangePreset.MONTH,
        categoryId: "category-1",
        dateSummary: "1 month",
        isDefaultDateRange: true,
        ...OPTIONS,
      })
    ).toEqual([{ id: "categoryId", label: "Category: Utilities" }]);
  });

  test("shows all time and custom date ranges", () => {
    const base = {
      categoryId: "",
      isDefaultDateRange: false,
      ...OPTIONS,
    };

    expect(
      buildExpenseToolbarFilterItems({
        ...base,
        activePreset: DateRangePreset.ALL,
        dateSummary: "All time",
      })
    ).toEqual([{ id: "date", label: "Date: All time" }]);

    expect(
      buildExpenseToolbarFilterItems({
        ...base,
        activePreset: null,
        dateSummary: "2026-07-01 – 2026-07-10",
      })
    ).toEqual([{ id: "date", label: "Date: 2026-07-01 – 2026-07-10" }]);
  });
});

describe("expense toolbar clear patches", () => {
  const defaultDateRange = { from: "2026-07-01", to: "2026-07-31" };

  test("clears one filter and restores the default date range", () => {
    expect(buildExpenseToolbarClearOnePatch("categoryId", defaultDateRange)).toEqual({
      categoryId: "",
    });
    expect(buildExpenseToolbarClearOnePatch("date", defaultDateRange)).toEqual({
      allTime: "",
      ...defaultDateRange,
    });
  });

  test("clear all restores dates and clears search without touching sort", () => {
    expect(buildExpenseToolbarClearAllPatch(defaultDateRange)).toEqual({
      allTime: "",
      categoryId: "",
      from: "2026-07-01",
      q: "",
      to: "2026-07-31",
    });
  });
});
