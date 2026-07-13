import { describe, expect, test } from "bun:test";

import { DateRangePreset } from "@/lib/date-range-presets";

import {
  buildIncomeToolbarClearAllPatch,
  buildIncomeToolbarClearOnePatch,
  buildIncomeToolbarFilterItems,
  countIncomeSecondaryFilters,
} from "./income-toolbar-filters";

const OPTIONS = {
  channelOptions: [{ label: "Airbnb", value: "channel-1" }],
  incomeTypeOptions: [{ label: "Stay", value: "stay" }],
  refundStatusOptions: [{ label: "Refunded", value: "refunded" }],
  statusOptions: [{ label: "Active", value: "active" }],
  unitOptions: [{ label: "Unit 101", value: "unit-1" }],
};

describe("countIncomeSecondaryFilters", () => {
  test("counts only populated secondary filters", () => {
    expect(
      countIncomeSecondaryFilters({
        channelCommissionId: "channel-1",
        incomeType: "",
        refundStatus: "refunded",
        status: "",
        unitId: "unit-1",
      })
    ).toBe(3);
  });
});

describe("buildIncomeToolbarFilterItems", () => {
  test("omits the default month and resolves option labels", () => {
    expect(
      buildIncomeToolbarFilterItems({
        activePreset: DateRangePreset.MONTH,
        channelCommissionId: "channel-1",
        dateSummary: "1 month",
        incomeType: "",
        isDefaultDateRange: true,
        refundStatus: "",
        status: "active",
        unitId: "unit-1",
        ...OPTIONS,
      })
    ).toEqual([
      { id: "unitId", label: "Unit: Unit 101" },
      { id: "channelCommissionId", label: "Channel: Airbnb" },
      { id: "status", label: "Status: Active" },
    ]);
  });

  test("shows all time and custom date ranges", () => {
    const base = {
      channelCommissionId: "",
      incomeType: "",
      isDefaultDateRange: false,
      refundStatus: "",
      status: "",
      unitId: "",
      ...OPTIONS,
    };

    expect(
      buildIncomeToolbarFilterItems({
        ...base,
        activePreset: DateRangePreset.ALL,
        dateSummary: "All time",
      })
    ).toEqual([{ id: "date", label: "Date: All time" }]);

    expect(
      buildIncomeToolbarFilterItems({
        ...base,
        activePreset: null,
        dateSummary: "2026-07-01 – 2026-07-10",
      })
    ).toEqual([{ id: "date", label: "Date: 2026-07-01 – 2026-07-10" }]);
  });
});

describe("income toolbar clear patches", () => {
  const defaultDateRange = { from: "2026-07-01", to: "2026-07-31" };

  test("clears one filter and restores the default date range", () => {
    expect(buildIncomeToolbarClearOnePatch("unitId", defaultDateRange)).toEqual({ unitId: "" });
    expect(buildIncomeToolbarClearOnePatch("date", defaultDateRange)).toEqual({
      allTime: "",
      ...defaultDateRange,
    });
  });

  test("clear all restores dates and clears search without touching sort", () => {
    expect(buildIncomeToolbarClearAllPatch(defaultDateRange)).toEqual({
      allTime: "",
      channelCommissionId: "",
      from: "2026-07-01",
      incomeType: "",
      q: "",
      refundStatus: "",
      status: "",
      to: "2026-07-31",
      unitId: "",
    });
  });
});
