import { describe, expect, test } from "bun:test";

import { DateRangePreset } from "@/lib/date-range-presets";
import { PropertyLongStayStatus } from "@/packages/shared";

import {
  buildLeaseToolbarClearAllPatch,
  buildLeaseToolbarClearOnePatch,
  buildLeaseToolbarFilterItems,
  countLeaseSecondaryFilters,
  DEFAULT_LEASE_STATUS_FILTER,
  LEASE_STATUS_FILTER_ALL,
  LEASE_STATUS_FILTER_OPTIONS,
} from "./lease-toolbar-filters";

const OPTIONS = {
  statusOptions: LEASE_STATUS_FILTER_OPTIONS,
  unitOptions: [{ label: "Unit 101", value: "unit-1" }],
};

describe("countLeaseSecondaryFilters", () => {
  test("counts only non-default secondary filters", () => {
    expect(
      countLeaseSecondaryFilters({ status: PropertyLongStayStatus.ACTIVE, unitId: "unit-1" })
    ).toBe(1);
    expect(
      countLeaseSecondaryFilters({ status: LEASE_STATUS_FILTER_ALL, unitId: "" })
    ).toBe(1);
    expect(
      countLeaseSecondaryFilters({ status: PropertyLongStayStatus.ENDED, unitId: "" })
    ).toBe(1);
    expect(
      countLeaseSecondaryFilters({ status: PropertyLongStayStatus.ACTIVE, unitId: "" })
    ).toBe(0);
  });
});

describe("buildLeaseToolbarFilterItems", () => {
  test("omits default all-time and active status while resolving other labels", () => {
    expect(
      buildLeaseToolbarFilterItems({
        activePreset: DateRangePreset.ALL,
        allTime: true,
        dateSummary: "All time",
        q: "",
        status: PropertyLongStayStatus.ACTIVE,
        unitId: "unit-1",
        ...OPTIONS,
      })
    ).toEqual([{ id: "unitId", label: "Unit: Unit 101" }]);
  });

  test("shows custom date ranges, non-default status, and search chips", () => {
    const base = {
      allTime: false,
      q: "",
      status: PropertyLongStayStatus.ACTIVE,
      unitId: "",
      ...OPTIONS,
    };

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
        status: LEASE_STATUS_FILTER_ALL,
      })
    ).toEqual([
      { id: "date", label: "Date: 1 month" },
      { id: "status", label: "Status: All leases" },
    ]);

    expect(
      buildLeaseToolbarFilterItems({
        ...base,
        activePreset: DateRangePreset.MONTH,
        dateSummary: "1 month",
        q: "Tenant A",
        status: PropertyLongStayStatus.ENDED,
      })
    ).toEqual([
      { id: "date", label: "Date: 1 month" },
      { id: "status", label: "Status: Ended" },
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

  test("clear all restores defaults for date, status, and secondary filters", () => {
    expect(buildLeaseToolbarClearAllPatch(defaultDateRange)).toEqual({
      allTime: "true",
      from: "2026-07-01",
      q: "",
      status: DEFAULT_LEASE_STATUS_FILTER,
      to: "2026-07-15",
      unitId: "",
    });
  });
});
