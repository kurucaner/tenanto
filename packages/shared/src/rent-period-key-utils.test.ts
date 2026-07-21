import { describe, expect, test } from "bun:test";

import {
  LEASE_UPCOMING_RENT_PERIOD_ERROR,
  resolveDefaultRentPeriodForIncomeLine,
  resolveLeaseIncomeRentPeriodKey,
  resolveLeaseIncomeRentPeriodMonth,
} from "./lease-income-rent-period";
import {
  comparePeriodKeys,
  formatRentPeriodLabel,
  inferRentScheduleCadence,
  isMonthlyPeriodKey,
  isPeriodKeyOnOrBefore,
  isValidRentPeriodKey,
  isWeeklyPeriodKey,
  resolveAsOfPeriodKey,
  resolveRentPeriodKeyForTransactionDate,
} from "./rent-period-key-utils";

describe("isMonthlyPeriodKey", () => {
  test("accepts YYYY-MM and rejects other formats", () => {
    expect(isMonthlyPeriodKey("2026-07")).toBe(true);
    expect(isMonthlyPeriodKey("2026-07-15")).toBe(false);
    expect(isMonthlyPeriodKey("2026-13")).toBe(false);
  });
});

describe("isWeeklyPeriodKey", () => {
  test("accepts YYYY-MM-DD and rejects month-only keys", () => {
    expect(isWeeklyPeriodKey("2026-07-15")).toBe(true);
    expect(isWeeklyPeriodKey("2026-07")).toBe(false);
    expect(isWeeklyPeriodKey("2026-13-01")).toBe(false);
  });
});

describe("isValidRentPeriodKey", () => {
  test("accepts monthly or weekly keys", () => {
    expect(isValidRentPeriodKey("2026-07")).toBe(true);
    expect(isValidRentPeriodKey("2026-07-15")).toBe(true);
    expect(isValidRentPeriodKey("invalid")).toBe(false);
  });
});

describe("comparePeriodKeys", () => {
  test("orders keys lexicographically across formats", () => {
    expect(comparePeriodKeys("2026-07", "2026-07-15")).toBeLessThan(0);
    expect(comparePeriodKeys("2026-07-15", "2026-07-22")).toBeLessThan(0);
    expect(comparePeriodKeys("2026-07-15", "2026-07-15")).toBe(0);
  });

  test("supports due/upcoming partition comparisons", () => {
    expect(isPeriodKeyOnOrBefore("2026-07-15", "2026-07-20")).toBe(true);
    expect(isPeriodKeyOnOrBefore("2026-07-22", "2026-07-20")).toBe(false);
    expect(isPeriodKeyOnOrBefore("2026-06", "2026-07")).toBe(true);
  });
});

describe("formatRentPeriodLabel", () => {
  test("formats monthly keys like calendar months", () => {
    expect(formatRentPeriodLabel("2026-07")).toMatch(/July 2026/);
  });

  test("formats weekly keys as week-of labels", () => {
    expect(formatRentPeriodLabel("2026-07-15")).toMatch(/^Week of Jul 15, 2026$/);
  });
});

describe("inferRentScheduleCadence", () => {
  test("infers cadence from the first schedule period key", () => {
    expect(inferRentScheduleCadence(["2026-01", "2026-02"])).toBe("monthly");
    expect(inferRentScheduleCadence(["2026-01-15", "2026-01-22"])).toBe("weekly");
    expect(inferRentScheduleCadence([])).toBeNull();
  });
});

describe("resolveAsOfPeriodKey", () => {
  test("uses full date for weekly schedules and month for monthly schedules", () => {
    expect(resolveAsOfPeriodKey("2026-07-20", ["2026-07-15", "2026-07-22"])).toBe("2026-07-20");
    expect(resolveAsOfPeriodKey("2026-07-20", ["2026-07", "2026-08"])).toBe("2026-07");
  });
});

describe("resolveRentPeriodKeyForTransactionDate", () => {
  const weeklySchedule = ["2026-01-15", "2026-01-22", "2026-01-29"];

  test("maps transaction date to containing week start", () => {
    expect(resolveRentPeriodKeyForTransactionDate("2026-01-20", weeklySchedule)).toBe("2026-01-15");
    expect(resolveRentPeriodKeyForTransactionDate("2026-01-22", weeklySchedule)).toBe("2026-01-22");
  });

  test("returns null when transaction date is outside weekly schedule", () => {
    expect(resolveRentPeriodKeyForTransactionDate("2026-02-10", weeklySchedule)).toBeNull();
  });

  test("defaults monthly schedules to YYYY-MM", () => {
    expect(resolveRentPeriodKeyForTransactionDate("2026-02-15", ["2026-01", "2026-02"])).toBe(
      "2026-02"
    );
  });
});

describe("resolveDefaultRentPeriodForIncomeLine", () => {
  const weeklySchedule = ["2026-01-15", "2026-01-22", "2026-01-29"];

  test("defaults weekly schedules to the week containing transactionDate", () => {
    expect(
      resolveDefaultRentPeriodForIncomeLine({
        scheduleMonths: weeklySchedule,
        transactionDate: "2026-01-20",
      })
    ).toEqual({ ok: true, value: "2026-01-15" });
  });

  test("accepts explicit weekly rentPeriodKey on schedule", () => {
    expect(
      resolveDefaultRentPeriodForIncomeLine({
        rentPeriodKey: "2026-01-22",
        scheduleMonths: weeklySchedule,
        transactionDate: "2026-01-20",
      })
    ).toEqual({ ok: true, value: "2026-01-22" });
  });

  test("rejects invalid weekly rentPeriodKey format", () => {
    expect(
      resolveDefaultRentPeriodForIncomeLine({
        rentPeriodKey: "2026-13-01",
        scheduleMonths: weeklySchedule,
        transactionDate: "2026-01-20",
      })
    ).toEqual({
      error: "rentPeriodKey must be YYYY-MM or YYYY-MM-DD",
      ok: false,
    });
  });

  test("rejects upcoming weekly periods against asOf date", () => {
    expect(
      resolveDefaultRentPeriodForIncomeLine({
        asOfMonth: "2026-01-20",
        rentPeriodKey: "2026-01-22",
        scheduleMonths: weeklySchedule,
        transactionDate: "2026-01-20",
      })
    ).toEqual({ error: LEASE_UPCOMING_RENT_PERIOD_ERROR, ok: false });
  });

  test("resolveDefaultRentPeriodForIncomeLine remains an alias of resolveLeaseIncomeRentPeriodKey", () => {
    expect(resolveDefaultRentPeriodForIncomeLine).toBe(resolveLeaseIncomeRentPeriodKey);
  });

  test("resolveLeaseIncomeRentPeriodMonth delegates to resolveLeaseIncomeRentPeriodKey", () => {
    const input = {
      scheduleMonths: weeklySchedule,
      transactionDate: "2026-01-20",
    };

    expect(resolveLeaseIncomeRentPeriodMonth(input)).toEqual(
      resolveLeaseIncomeRentPeriodKey(input)
    );
  });
});
