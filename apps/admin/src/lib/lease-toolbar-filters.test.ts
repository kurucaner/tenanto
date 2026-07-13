import { describe, expect, test } from "bun:test";

import { DateRangePreset } from "@/lib/date-range-presets";
import { PropertyLongStayStatus } from "@/packages/shared";

import {
  buildLeaseToolbarClearAllPatch,
  buildLeaseToolbarClearOnePatch,
  buildLeaseToolbarFilterItems,
  countLeaseSecondaryFilters,
} from "./lease-toolbar-filters";

const OPTIONS = {
  statusOptions: [
    { label: "All", value: "" },
    { label: "Active", value: PropertyLongStayStatus.ACTIVE },
    { label: "Ended", value: PropertyLongStayStatus.ENDED },
  ],
  unitOptions: [{ label: "Unit 101", value: "unit-1" }],
};

describe("countLeaseSecondaryFilters", () => {
  test("counts only populated secondary filters", () => {
    expect(
      countLeaseSecondaryFilters({ status: PropertyLongStayStatus.ACTIVE, unitId: "unit-1" })
    ).toBe(2);
    expect(countLeaseSecondaryFilters({ status: "", unitId: "" })).toBe(0);
  });
});

describe("buildLeaseToolbarFilterItems", () => {
  test("omits the default month and resolves unit and status labels", () => {
    expect(
      buildLeaseToolbarFilterItems({
        activePreset: DateRangePreset.CURRENT_MONTH,
        dateSummary: "Current month",
        isDefaultDateRange: true,
        q: "",
        status: PropertyLongStayStatus.ACTIVE,
        unitId: "unit-1",
        ...OPTIONS,
      })
    ).toEqual([
      { id: "unitId", label: "Unit: Unit 101" },
      { id: "status", label: "Status: Active" },
    ]);
  });

  test("shows all time, custom date ranges, and search chips", () => {
    const base = {
      isDefaultDateRange: false,
      q: "",
      status: "",
      unitId: "",
      ...OPTIONS,
    };

    expect(
      buildLeaseToolbarFilterItems({
        ...base,
        activePreset: DateRangePreset.ALL,
        dateSummary: "All time",
      })
    ).toEqual([{ id: "date", label: "Date: All time" }]);

    expect(
      buildLeaseToolbarFilterItems({
        ...base,
        activePreset: null,
        dateSummary: "2026-07-01 – 2026-07-10",
      })
    ).toEqual([{ id: "date", label: "Date: 2026-07-01 – 2026-07-10" }]);

    expect(
      buildLeaseToolbarFilterItems({
        ...base,
        activePreset: DateRangePreset.MONTH,
        dateSummary: "1 month",
        q: "Tenant A",
      })
    ).toEqual([
      { id: "date", label: "Date: 1 month" },
      { id: "q", label: "Search: Tenant A" },
    ]);
  });
});

describe("lease toolbar clear patches", () => {
  const defaultDateRange = { from: "2026-07-01", to: "2026-07-15" };

  test("clears one filter and restores the default date range", () => {
    expect(buildLeaseToolbarClearOnePatch("unitId", defaultDateRange)).toEqual({ unitId: "" });
    expect(buildLeaseToolbarClearOnePatch("status", defaultDateRange)).toEqual({ status: "" });
    expect(buildLeaseToolbarClearOnePatch("q", defaultDateRange)).toEqual({ q: "" });
    expect(buildLeaseToolbarClearOnePatch("date", defaultDateRange)).toEqual({
      allTime: "",
      ...defaultDateRange,
    });
  });

  test("clear all restores dates and clears search and secondary filters", () => {
    expect(buildLeaseToolbarClearAllPatch(defaultDateRange)).toEqual({
      allTime: "",
      from: "2026-07-01",
      q: "",
      status: "",
      to: "2026-07-15",
      unitId: "",
    });
  });
});
