import { describe, expect, test } from "bun:test";

import { type IPropertyLongStayRentMonth } from "@/packages/shared";

import { buildLeaseRecordRentPrefill } from "./lease-record-rent-prefill";
import {
  getExpectedRentForScheduleMonth,
  partitionRentSchedule,
} from "./lease-rent-schedule-display";

function buildRentMonth(
  overrides: Partial<IPropertyLongStayRentMonth> & Pick<IPropertyLongStayRentMonth, "month">
): IPropertyLongStayRentMonth {
  const expectedRent = overrides.expectedRent ?? 1000;
  const isPaid = overrides.isPaid ?? false;
  const paidRent = overrides.paidRent ?? (isPaid ? expectedRent : 0);

  return {
    daysInMonth: 30,
    expectedRent,
    isPaid,
    isProrated: false,
    occupiedDays: 30,
    paidRent,
    remainingRent: overrides.remainingRent ?? Math.max(0, expectedRent - paidRent),
    ...overrides,
  };
}

const MID_MONTH_START_SCHEDULE: IPropertyLongStayRentMonth[] = [
  buildRentMonth({
    daysInMonth: 30,
    expectedRent: 500,
    isProrated: true,
    month: "2024-06",
    occupiedDays: 15,
  }),
  buildRentMonth({ expectedRent: 1000, month: "2024-07" }),
  buildRentMonth({ expectedRent: 1000, isPaid: true, month: "2024-08" }),
];

const HOLD_OVER_SCHEDULE: IPropertyLongStayRentMonth[] = [
  buildRentMonth({ expectedRent: 1000, isPaid: true, month: "2024-06" }),
  buildRentMonth({
    daysInMonth: 31,
    expectedRent: 161.29,
    isProrated: true,
    month: "2024-07",
    occupiedDays: 5,
  }),
];

const MIXED_DUE_UPCOMING_SCHEDULE: IPropertyLongStayRentMonth[] = [
  buildRentMonth({ expectedRent: 500, month: "2024-06" }),
  buildRentMonth({ expectedRent: 1000, month: "2024-07" }),
  buildRentMonth({ expectedRent: 1000, month: "2024-09" }),
];

describe("partitionRentSchedule", () => {
  test("sums prorated due unpaid expectedRent amounts for the summary total", () => {
    const { dueUnpaidMonths, paidMonths, unpaidSummary } = partitionRentSchedule(
      MID_MONTH_START_SCHEDULE,
      "2024-07"
    );

    expect(dueUnpaidMonths.map((item) => item.month)).toEqual(["2024-06", "2024-07"]);
    expect(paidMonths.map((item) => item.month)).toEqual(["2024-08"]);
    expect(unpaidSummary).toEqual({ count: 2, totalExpected: 1500 });
  });

  test("includes holdover proration in due unpaid totals", () => {
    const { unpaidSummary } = partitionRentSchedule(HOLD_OVER_SCHEDULE, "2024-07");

    expect(unpaidSummary).toEqual({ count: 1, totalExpected: 161.29 });
  });

  test("separates future unpaid months into upcoming and excludes them from summary", () => {
    const { dueUnpaidMonths, unpaidSummary, upcomingMonths } = partitionRentSchedule(
      MIXED_DUE_UPCOMING_SCHEDULE,
      "2024-07"
    );

    expect(dueUnpaidMonths.map((item) => item.month)).toEqual(["2024-06", "2024-07"]);
    expect(upcomingMonths.map((item) => item.month)).toEqual(["2024-09"]);
    expect(unpaidSummary).toEqual({ count: 2, totalExpected: 1500 });
  });
});

describe("getExpectedRentForScheduleMonth", () => {
  test("returns prorated expectedRent for a partial first month", () => {
    expect(getExpectedRentForScheduleMonth(MID_MONTH_START_SCHEDULE, "2024-06")).toBe(500);
  });

  test("returns undefined when the month is not in the schedule", () => {
    expect(getExpectedRentForScheduleMonth(MID_MONTH_START_SCHEDULE, "2024-05")).toBeUndefined();
  });
});

describe("buildLeaseRecordRentPrefill", () => {
  const lease = {
    guestName: "Tenant",
    id: "lease-1",
    monthlyRent: 1000,
    unitId: "unit-1",
  };

  test("prefills prorated expectedRent from the rent schedule", () => {
    const prefill = buildLeaseRecordRentPrefill(lease, "income-type-rent", {
      month: "2024-06",
      rentSchedule: MID_MONTH_START_SCHEDULE,
    });

    expect(prefill.amount).toBe("500");
    expect(prefill.longStayId).toBe("lease-1");
    expect(prefill.rentPeriodMonth).toBe("2024-06");
    expect(prefill.transactionDate).toBe("2024-06-01");
  });

  test("falls back to lease monthlyRent when no month is provided", () => {
    const prefill = buildLeaseRecordRentPrefill(lease, "income-type-rent");

    expect(prefill.amount).toBe("1000");
  });

  test("uses explicit expectedAmount when rent schedule is not provided", () => {
    const prefill = buildLeaseRecordRentPrefill(lease, "income-type-rent", {
      expectedAmount: 483.87,
      month: "2024-07",
    });

    expect(prefill.amount).toBe("483.87");
  });
});
