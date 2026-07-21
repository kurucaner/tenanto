import { describe, expect, test } from "bun:test";

import { enumerateLeaseWeeks, getLeaseWeekPeriodEnd } from "./lease-date-utils";
import {
  calculateExpectedRentForLeaseWeek,
  getOccupiedDaysInWeek,
  isProratedLeaseWeek,
} from "./lease-week-proration-utils";

describe("enumerateLeaseWeeks", () => {
  test("lists week period starts through lease end", () => {
    expect(enumerateLeaseWeeks("2026-01-15", "2026-02-10")).toEqual([
      "2026-01-15",
      "2026-01-22",
      "2026-01-29",
      "2026-02-05",
    ]);
  });

  test("returns a single period when lease fits in one week", () => {
    expect(enumerateLeaseWeeks("2026-01-15", "2026-01-21")).toEqual(["2026-01-15"]);
  });

  test("includes a final partial week when lease ends on the next period start", () => {
    expect(enumerateLeaseWeeks("2026-01-15", "2026-01-22")).toEqual(["2026-01-15", "2026-01-22"]);
  });

  test("includes only the first week when lease ends mid-week", () => {
    expect(enumerateLeaseWeeks("2026-01-15", "2026-01-20")).toEqual(["2026-01-15"]);
  });

  test("returns empty when lease end is before start", () => {
    expect(enumerateLeaseWeeks("2026-01-20", "2026-01-15")).toEqual([]);
  });
});

describe("getLeaseWeekPeriodEnd", () => {
  test("returns six days after period start", () => {
    expect(getLeaseWeekPeriodEnd("2026-01-15")).toBe("2026-01-21");
  });
});

describe("getOccupiedDaysInWeek", () => {
  test("counts full week within lease term", () => {
    expect(getOccupiedDaysInWeek("2026-01-15", "2026-01-15", "2026-03-31")).toBe(7);
  });

  test("prorates when lease ends mid-week", () => {
    expect(getOccupiedDaysInWeek("2026-01-15", "2026-01-15", "2026-01-20")).toBe(6);
  });

  test("prorates final week to one day when lease ends on period start", () => {
    expect(getOccupiedDaysInWeek("2026-01-22", "2026-01-15", "2026-01-22")).toBe(1);
  });

  test("returns zero when period is outside lease occupancy", () => {
    expect(getOccupiedDaysInWeek("2026-01-22", "2026-01-15", "2026-01-21")).toBe(0);
  });
});

describe("calculateExpectedRentForLeaseWeek", () => {
  const weeklyRent = 700;
  const leaseStartDate = "2026-01-15";

  test("charges full weekly rent for a complete week", () => {
    expect(
      calculateExpectedRentForLeaseWeek({
        effectiveEndDate: "2026-03-31",
        leaseStartDate,
        periodStart: "2026-01-15",
        weeklyRent,
      })
    ).toEqual({
      daysInPeriod: 7,
      expectedRent: 700,
      isProrated: false,
      occupiedDays: 7,
    });
  });

  test("prorates first week when lease ends before period end", () => {
    expect(
      calculateExpectedRentForLeaseWeek({
        effectiveEndDate: "2026-01-20",
        leaseStartDate,
        periodStart: "2026-01-15",
        weeklyRent,
      })
    ).toEqual({
      daysInPeriod: 7,
      expectedRent: 600,
      isProrated: true,
      occupiedDays: 6,
    });
  });

  test("prorates final week when lease ends on next period start", () => {
    expect(
      calculateExpectedRentForLeaseWeek({
        effectiveEndDate: "2026-01-22",
        leaseStartDate,
        periodStart: "2026-01-22",
        weeklyRent,
      })
    ).toEqual({
      daysInPeriod: 7,
      expectedRent: 100,
      isProrated: true,
      occupiedDays: 1,
    });
  });

  test("returns zero rent when period has no occupied days", () => {
    expect(
      calculateExpectedRentForLeaseWeek({
        effectiveEndDate: "2026-01-21",
        leaseStartDate,
        periodStart: "2026-01-22",
        weeklyRent,
      })
    ).toEqual({
      daysInPeriod: 7,
      expectedRent: 0,
      isProrated: false,
      occupiedDays: 0,
    });
  });
});

describe("isProratedLeaseWeek", () => {
  test("returns false for full weeks and true for partial weeks", () => {
    expect(isProratedLeaseWeek("2026-01-15", "2026-01-15", "2026-03-31")).toBe(false);
    expect(isProratedLeaseWeek("2026-01-15", "2026-01-15", "2026-01-20")).toBe(true);
    expect(isProratedLeaseWeek("2026-01-22", "2026-01-15", "2026-01-22")).toBe(true);
  });
});
