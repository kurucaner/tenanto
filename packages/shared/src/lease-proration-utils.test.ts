import { describe, expect, test } from "bun:test";

import {
  calculateExpectedRentForLeaseMonth,
  getDaysInMonth,
  getLeaseScheduleEffectiveEndDate,
  getOccupiedDaysInMonth,
  isProratedLeaseMonth,
} from "./lease-proration-utils";
import { PropertyLongStayStatus } from "./property-long-stay-types";

const activeLease = {
  actualEndDate: null,
  leaseEndDate: "2024-12-31",
  status: PropertyLongStayStatus.ACTIVE,
} as const;

describe("getDaysInMonth", () => {
  test("returns calendar days for standard and leap-year February", () => {
    expect(getDaysInMonth("2024-06")).toBe(30);
    expect(getDaysInMonth("2024-02")).toBe(29);
    expect(getDaysInMonth("2025-02")).toBe(28);
    expect(getDaysInMonth("2024-01")).toBe(31);
  });
});

describe("getOccupiedDaysInMonth", () => {
  test("counts inclusive days for a mid-month lease start", () => {
    expect(getOccupiedDaysInMonth("2024-06", "2024-06-16", "2024-12-31")).toBe(15);
  });

  test("counts inclusive days for an early move-out", () => {
    expect(getOccupiedDaysInMonth("2024-07", "2024-01-01", "2024-07-15")).toBe(15);
  });

  test("counts holdover days in the month after lease end", () => {
    expect(getOccupiedDaysInMonth("2024-07", "2024-01-01", "2024-07-05")).toBe(5);
  });

  test("counts same-month start and end occupancy", () => {
    expect(getOccupiedDaysInMonth("2024-06", "2024-06-16", "2024-06-25")).toBe(10);
  });

  test("returns zero when the month is outside occupancy", () => {
    expect(getOccupiedDaysInMonth("2024-08", "2024-01-01", "2024-07-15")).toBe(0);
  });
});

describe("getLeaseScheduleEffectiveEndDate", () => {
  test("uses actual end date for ended leases", () => {
    expect(
      getLeaseScheduleEffectiveEndDate(
        {
          actualEndDate: "2024-07-05",
          leaseEndDate: "2024-06-30",
          status: PropertyLongStayStatus.ENDED,
        },
        "2024-07-09"
      )
    ).toBe("2024-07-05");
  });

  test("uses lease end date for active leases still within term", () => {
    expect(getLeaseScheduleEffectiveEndDate(activeLease, "2024-07-09")).toBe("2024-12-31");
  });

  test("uses today for active holdover leases", () => {
    expect(
      getLeaseScheduleEffectiveEndDate(
        { ...activeLease, leaseEndDate: "2024-06-30" },
        "2024-07-09"
      )
    ).toBe("2024-07-09");
  });
});

describe("calculateExpectedRentForLeaseMonth", () => {
  test("prorates the first month when the lease starts mid-month", () => {
    const june = calculateExpectedRentForLeaseMonth({
      baseMonthlyRent: 1000,
      effectiveEndDate: "2024-12-31",
      leaseStartDate: "2024-06-16",
      month: "2024-06",
      rentPeriods: [],
    });
    const july = calculateExpectedRentForLeaseMonth({
      baseMonthlyRent: 1000,
      effectiveEndDate: "2024-12-31",
      leaseStartDate: "2024-06-16",
      month: "2024-07",
      rentPeriods: [],
    });

    expect(june).toEqual({
      daysInMonth: 30,
      expectedRent: 500,
      isProrated: true,
      occupiedDays: 15,
    });
    expect(july).toEqual({
      daysInMonth: 31,
      expectedRent: 1000,
      isProrated: false,
      occupiedDays: 31,
    });
  });

  test("prorates the last month for an early move-out", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-07-15",
        leaseStartDate: "2024-01-01",
        month: "2024-07",
        rentPeriods: [],
      })
    ).toEqual({
      daysInMonth: 31,
      expectedRent: 483.87,
      isProrated: true,
      occupiedDays: 15,
    });
  });

  test("prorates holdover days in the month after lease end", () => {
    const june = calculateExpectedRentForLeaseMonth({
      baseMonthlyRent: 1000,
      effectiveEndDate: "2024-07-05",
      leaseStartDate: "2024-01-01",
      month: "2024-06",
      rentPeriods: [],
    });
    const july = calculateExpectedRentForLeaseMonth({
      baseMonthlyRent: 1000,
      effectiveEndDate: "2024-07-05",
      leaseStartDate: "2024-01-01",
      month: "2024-07",
      rentPeriods: [],
    });

    expect(june).toEqual({
      daysInMonth: 30,
      expectedRent: 1000,
      isProrated: false,
      occupiedDays: 30,
    });
    expect(july).toEqual({
      daysInMonth: 31,
      expectedRent: 161.29,
      isProrated: true,
      occupiedDays: 5,
    });
  });

  test("prorates a same-month start and end lease", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-06-25",
        leaseStartDate: "2024-06-16",
        month: "2024-06",
        rentPeriods: [],
      })
    ).toEqual({
      daysInMonth: 30,
      expectedRent: 333.33,
      isProrated: true,
      occupiedDays: 10,
    });
  });

  test("handles February in leap and non-leap years", () => {
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

  test("charges full rent when occupancy covers the full month", () => {
    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-06-30",
        leaseStartDate: "2024-06-01",
        month: "2024-06",
        rentPeriods: [],
      })
    ).toEqual({
      daysInMonth: 30,
      expectedRent: 1000,
      isProrated: false,
      occupiedDays: 30,
    });
  });

  test("uses the rent period rate for a prorated month after a rent change", () => {
    const periods = [{ effectiveFromMonth: "2024-07", monthlyRent: 1200 }];

    expect(
      calculateExpectedRentForLeaseMonth({
        baseMonthlyRent: 1000,
        effectiveEndDate: "2024-12-31",
        leaseStartDate: "2024-06-16",
        month: "2024-07",
        rentPeriods: periods,
      }).expectedRent
    ).toBe(1200);
  });
});

describe("isProratedLeaseMonth", () => {
  test("returns true only for partial months", () => {
    expect(isProratedLeaseMonth("2024-06", "2024-06-16", "2024-12-31")).toBe(true);
    expect(isProratedLeaseMonth("2024-07", "2024-06-16", "2024-12-31")).toBe(false);
  });
});
