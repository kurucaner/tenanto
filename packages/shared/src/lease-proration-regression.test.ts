import { describe, expect, test } from "bun:test";

import {
  calculateExpectedRentForLeaseMonth,
  getDaysInMonth,
  getOccupiedDaysInMonth,
} from "./lease-proration-utils";

describe("lease proration manual QA regression matrix", () => {
  test("1. mid-month start prorates the first month", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-12-31",
        leaseStartDate: "2024-06-16",
        month: "2024-06",
        rentPeriods: [],
      })
    ).toMatchObject({
      daysInMonth: 30,
      expectedRent: 500,
      isProrated: true,
      occupiedDays: 15,
    });
  });

  test("2. early move-out prorates the last month", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-07-15",
        leaseStartDate: "2024-01-01",
        month: "2024-07",
        rentPeriods: [],
      })
    ).toMatchObject({
      daysInMonth: 31,
      expectedRent: 483.87,
      isProrated: true,
      occupiedDays: 15,
    });
  });

  test("3. five-day holdover prorates the month after contract end", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-07-05",
        leaseStartDate: "2024-01-01",
        month: "2024-07",
        rentPeriods: [],
      })
    ).toMatchObject({
      daysInMonth: 31,
      expectedRent: 161.29,
      isProrated: true,
      occupiedDays: 5,
    });
  });

  test("4. full-month start and end charges full rent", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-06-30",
        leaseStartDate: "2024-06-01",
        month: "2024-06",
        rentPeriods: [],
      })
    ).toMatchObject({
      daysInMonth: 30,
      expectedRent: 1000,
      isProrated: false,
      occupiedDays: 30,
    });
  });

  test("5. February leases use the correct day count", () => {
    expect(getDaysInMonth("2024-02")).toBe(29);
    expect(getDaysInMonth("2025-02")).toBe(28);
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-02-29",
        leaseStartDate: "2024-02-15",
        month: "2024-02",
        rentPeriods: [],
      }).expectedRent
    ).toBe(517.24);
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2025-02-28",
        leaseStartDate: "2025-02-15",
        month: "2025-02",
        rentPeriods: [],
      }).expectedRent
    ).toBe(500);
  });

  test("6. extended lease proration uses the rent period rate for that month", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2025-06-15",
        leaseStartDate: "2024-06-16",
        month: "2025-06",
        rentPeriods: [{ effectiveFromMonth: "2025-06", monthlyRent: 1200 }],
      })
    ).toMatchObject({
      daysInMonth: 30,
      expectedRent: 600,
      isProrated: true,
      occupiedDays: 15,
    });
  });

  test("7. custom contract end on month boundary avoids extra partial month", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2027-06-30",
        leaseStartDate: "2026-07-01",
        month: "2027-07",
        rentPeriods: [],
      })
    ).toMatchObject({
      expectedRent: 0,
      isProrated: false,
      occupiedDays: 0,
    });
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2027-06-30",
        leaseStartDate: "2026-07-01",
        month: "2027-06",
        rentPeriods: [],
      })
    ).toMatchObject({
      expectedRent: 1000,
      isProrated: false,
      occupiedDays: 30,
    });
  });

  test("8. mid-month start with custom end still prorates first and last months", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-12-20",
        leaseStartDate: "2024-06-16",
        month: "2024-06",
        rentPeriods: [],
      })
    ).toMatchObject({
      expectedRent: 500,
      isProrated: true,
      occupiedDays: 15,
    });
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-12-20",
        leaseStartDate: "2024-06-16",
        month: "2024-12",
        rentPeriods: [],
      })
    ).toMatchObject({
      expectedRent: 645.16,
      isProrated: true,
      occupiedDays: 20,
    });
  });
});

describe("lease proration date math stays on YYYY-MM-DD strings", () => {
  test("counts occupied days from ISO date parts without local timezone drift", () => {
    expect(getOccupiedDaysInMonth("2024-06", "2024-06-16", "2024-06-30")).toBe(15);
    expect(getOccupiedDaysInMonth("2024-07", "2024-01-01", "2024-07-05")).toBe(5);
  });
});
