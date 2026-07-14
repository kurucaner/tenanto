import { describe, expect, test } from "bun:test";

import { DateRangePreset } from "@/lib/date-range-presets";
import { ReportRentalTypeFilter } from "@/packages/shared";

import {
  buildReportToolbarClearAllPatch,
  buildReportToolbarClearOnePatch,
  buildReportToolbarFilterItems,
  countReportSecondaryFilters,
} from "./report-toolbar-filters";

const OPTIONS = {
  channelOptions: [{ label: "Airbnb", value: "channel-1" }],
  rentalTypeOptions: [
    { label: "Both", value: "" },
    { label: "Short term", value: ReportRentalTypeFilter.SHORT_TERM },
    { label: "Long term", value: ReportRentalTypeFilter.LONG_TERM },
  ],
  unitOptions: [{ label: "Unit 101", value: "unit-1" }],
};

describe("countReportSecondaryFilters", () => {
  test("counts only populated secondary filters", () => {
    expect(
      countReportSecondaryFilters({
        channelCommissionId: "channel-1",
        rentalType: ReportRentalTypeFilter.SHORT_TERM,
        unitId: "unit-1",
      })
    ).toBe(3);
    expect(
      countReportSecondaryFilters({
        channelCommissionId: "",
        rentalType: "",
        unitId: "",
      })
    ).toBe(0);
  });
});

describe("buildReportToolbarFilterItems", () => {
  test("omits the default month and resolves secondary filter labels", () => {
    expect(
      buildReportToolbarFilterItems({
        activePreset: DateRangePreset.CURRENT_MONTH,
        channelCommissionId: "channel-1",
        dateSummary: "Current month",
        isDefaultDateRange: true,
        rentalType: ReportRentalTypeFilter.SHORT_TERM,
        unitId: "unit-1",
        ...OPTIONS,
      })
    ).toEqual([
      { id: "unitId", label: "Unit: Unit 101" },
      { id: "channelCommissionId", label: "Channel: Airbnb" },
      { id: "rentalType", label: "Rental type: Short term" },
    ]);
  });

  test("shows custom date ranges", () => {
    expect(
      buildReportToolbarFilterItems({
        activePreset: null,
        channelCommissionId: "",
        dateSummary: "2026-07-01 – 2026-07-10",
        isDefaultDateRange: false,
        rentalType: "",
        unitId: "",
        ...OPTIONS,
      })
    ).toEqual([{ id: "date", label: "Date: 2026-07-01 – 2026-07-10" }]);
  });
});

describe("report toolbar clear patches", () => {
  const defaultDateRange = { from: "2026-07-01", to: "2026-07-15" };

  test("clears one filter and restores the default date range", () => {
    expect(buildReportToolbarClearOnePatch("unitId", defaultDateRange)).toEqual({ unitId: "" });
    expect(buildReportToolbarClearOnePatch("channelCommissionId", defaultDateRange)).toEqual({
      channelCommissionId: "",
    });
    expect(buildReportToolbarClearOnePatch("rentalType", defaultDateRange)).toEqual({
      rentalType: "",
    });
    expect(buildReportToolbarClearOnePatch("date", defaultDateRange)).toEqual({
      allTime: "",
      ...defaultDateRange,
    });
  });

  test("clear all restores dates and clears secondary filters", () => {
    expect(buildReportToolbarClearAllPatch(defaultDateRange)).toEqual({
      allTime: "",
      channelCommissionId: "",
      from: "2026-07-01",
      rentalType: "",
      to: "2026-07-15",
      unitId: "",
    });
  });
});
