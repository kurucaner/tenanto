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
  return {
    daysInMonth: 30,
    expectedRent: 1000,
    isPaid: false,
    isProrated: false,
    occupiedDays: 30,
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

describe("partitionRentSchedule", () => {
  test("sums prorated unpaid expectedRent amounts for the summary total", () => {
    const { paidMonths, unpaidMonths, unpaidSummary } =
      partitionRentSchedule(MID_MONTH_START_SCHEDULE);

    expect(unpaidMonths.map((item) => item.month)).toEqual(["2024-06", "2024-07"]);
    expect(paidMonths.map((item) => item.month)).toEqual(["2024-08"]);
    expect(unpaidSummary).toEqual({ count: 2, totalExpected: 1500 });
  });

  test("includes holdover proration in unpaid totals", () => {
    const { unpaidSummary } = partitionRentSchedule(HOLD_OVER_SCHEDULE);

    expect(unpaidSummary).toEqual({ count: 1, totalExpected: 161.29 });
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
