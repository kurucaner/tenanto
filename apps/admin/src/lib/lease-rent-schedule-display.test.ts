import { describe, expect, test } from "bun:test";

import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  formatRentPeriodLabel,
  type IPropertyLongStayRentMonth,
  RentBillingCadence,
} from "@/packages/shared";

import { buildLeaseRecordRentPrefill } from "./lease-record-rent-prefill";
import {
  getExpectedRentForScheduleMonth,
  getLeaseBillingCadenceLabel,
  getLeaseExtendTermsDescription,
  getLeaseRentAmountSuffix,
  getLeaseTermDisplayLabel,
  getRemainingRentForScheduleMonth,
  getVisibleLeaseRentPeriods,
  isRentMonthPartiallyPaid,
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
  test("sums remainingRent for due unpaid months in the summary total", () => {
    const { dueUnpaidMonths, paidMonths, unpaidSummary } = partitionRentSchedule(
      MID_MONTH_START_SCHEDULE,
      "2024-07-15"
    );

    expect(dueUnpaidMonths.map((item) => item.month)).toEqual(["2024-06", "2024-07"]);
    expect(paidMonths.map((item) => item.month)).toEqual(["2024-08"]);
    expect(unpaidSummary).toEqual({ count: 2, totalRemaining: 1500 });
  });

  test("includes holdover proration remaining in due unpaid totals", () => {
    const { unpaidSummary } = partitionRentSchedule(HOLD_OVER_SCHEDULE, "2024-07-15");

    expect(unpaidSummary).toEqual({ count: 1, totalRemaining: 161.29 });
  });

  test("separates future unpaid months into upcoming and excludes them from summary", () => {
    const { dueUnpaidMonths, unpaidSummary, upcomingMonths } = partitionRentSchedule(
      MIXED_DUE_UPCOMING_SCHEDULE,
      "2024-07-15"
    );

    expect(dueUnpaidMonths.map((item) => item.month)).toEqual(["2024-06", "2024-07"]);
    expect(upcomingMonths.map((item) => item.month)).toEqual(["2024-09"]);
    expect(unpaidSummary).toEqual({ count: 2, totalRemaining: 1500 });
  });

  test("keeps partially paid months in due unpaid and sums remaining only", () => {
    const schedule = [
      buildRentMonth({
        expectedRent: 1500,
        month: "2024-07",
        paidRent: 500,
        remainingRent: 1000,
      }),
      buildRentMonth({ expectedRent: 1000, isPaid: true, month: "2024-08" }),
    ];

    const { dueUnpaidMonths, paidMonths, unpaidSummary } = partitionRentSchedule(
      schedule,
      "2024-07-15"
    );

    expect(dueUnpaidMonths.map((item) => item.month)).toEqual(["2024-07"]);
    expect(paidMonths.map((item) => item.month)).toEqual(["2024-08"]);
    expect(unpaidSummary).toEqual({ count: 1, totalRemaining: 1000 });
  });
});

describe("isRentMonthPartiallyPaid", () => {
  test("returns true when some rent is paid but month is not fully paid", () => {
    expect(
      isRentMonthPartiallyPaid(
        buildRentMonth({ expectedRent: 1500, month: "2024-07", paidRent: 500, remainingRent: 1000 })
      )
    ).toBe(true);
  });

  test("returns false when nothing is paid or month is fully paid", () => {
    expect(isRentMonthPartiallyPaid(buildRentMonth({ expectedRent: 1500, month: "2024-07" }))).toBe(
      false
    );
    expect(
      isRentMonthPartiallyPaid(
        buildRentMonth({ expectedRent: 1500, isPaid: true, month: "2024-07", paidRent: 1500 })
      )
    ).toBe(false);
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

const WEEKLY_SCHEDULE: IPropertyLongStayRentMonth[] = [
  buildRentMonth({ expectedRent: 700, month: "2026-01-15" }),
  buildRentMonth({ expectedRent: 700, month: "2026-01-22" }),
  buildRentMonth({ expectedRent: 700, isPaid: true, month: "2026-01-29" }),
];

describe("partitionRentSchedule weekly", () => {
  test("partitions weekly schedule using week-start asOf keys", () => {
    const { dueUnpaidMonths, paidMonths, unpaidSummary, upcomingMonths } = partitionRentSchedule(
      WEEKLY_SCHEDULE,
      "2026-01-22"
    );

    expect(dueUnpaidMonths.map((item) => item.month)).toEqual(["2026-01-15", "2026-01-22"]);
    expect(upcomingMonths.map((item) => item.month)).toEqual([]);
    expect(paidMonths.map((item) => item.month)).toEqual(["2026-01-29"]);
    expect(unpaidSummary).toEqual({ count: 2, totalRemaining: 1400 });
  });

  test("treats future week starts as upcoming when asOf is before them", () => {
    const { dueUnpaidMonths, upcomingMonths } = partitionRentSchedule(
      WEEKLY_SCHEDULE,
      "2026-01-18"
    );

    expect(dueUnpaidMonths.map((item) => item.month)).toEqual(["2026-01-15"]);
    expect(upcomingMonths.map((item) => item.month)).toEqual(["2026-01-22"]);
  });
});

describe("formatRentPeriodLabel", () => {
  test("formats weekly period keys as week-of labels", () => {
    expect(formatRentPeriodLabel("2026-01-15")).toMatch(/^Week of /);
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
    const prefill = buildLeaseRecordRentPrefill(lease, {
      month: "2024-06",
      rentSchedule: MID_MONTH_START_SCHEDULE,
    });

    expect(prefill.amount).toBe("500");
    expect(prefill.longStayId).toBe("lease-1");
    expect(prefill.rentPeriodMonth).toBe("2024-06");
    expect(prefill.transactionDate).toBe(getTodayLocalIsoDate());
  });

  test("falls back to lease monthlyRent when no month is provided", () => {
    const prefill = buildLeaseRecordRentPrefill(lease);

    expect(prefill.amount).toBe("1000");
  });

  test("uses explicit expectedAmount when rent schedule is not provided", () => {
    const prefill = buildLeaseRecordRentPrefill(lease, {
      expectedAmount: 483.87,
      month: "2024-07",
    });

    expect(prefill.amount).toBe("483.87");
  });

  test("prefills remainingRent for partially paid schedule months", () => {
    const schedule = [
      buildRentMonth({
        expectedRent: 1500,
        month: "2024-07",
        paidRent: 500,
        remainingRent: 1000,
      }),
    ];
    const prefill = buildLeaseRecordRentPrefill(lease, {
      month: "2024-07",
      rentSchedule: schedule,
    });

    expect(prefill.amount).toBe("1000");
    expect(prefill.rentPeriodMonth).toBe("2024-07");
  });

  test("prefills weekly rentPeriodMonth for a due week", () => {
    const schedule = [buildRentMonth({ expectedRent: 700, month: "2026-01-15" })];
    const prefill = buildLeaseRecordRentPrefill(lease, {
      month: "2026-01-15",
      rentSchedule: schedule,
    });

    expect(prefill.amount).toBe("700");
    expect(prefill.rentPeriodMonth).toBe("2026-01-15");
  });
});

describe("getRemainingRentForScheduleMonth", () => {
  test("returns remainingRent for a schedule month", () => {
    expect(
      getRemainingRentForScheduleMonth(
        [
          buildRentMonth({
            expectedRent: 1500,
            month: "2024-07",
            paidRent: 500,
            remainingRent: 1000,
          }),
        ],
        "2024-07"
      )
    ).toBe(1000);
  });
});

describe("getLeaseBillingCadenceLabel", () => {
  test("returns cadence labels", () => {
    expect(getLeaseBillingCadenceLabel(RentBillingCadence.WEEKLY)).toBe("Weekly");
    expect(getLeaseBillingCadenceLabel(RentBillingCadence.MONTHLY)).toBe("Monthly");
  });
});

describe("getLeaseRentAmountSuffix", () => {
  test("returns cadence-specific suffixes", () => {
    expect(getLeaseRentAmountSuffix(RentBillingCadence.WEEKLY)).toBe("/wk");
    expect(getLeaseRentAmountSuffix(RentBillingCadence.MONTHLY)).toBe("/mo");
  });
});

describe("getLeaseTermDisplayLabel", () => {
  test("shows week count for weekly leases", () => {
    expect(
      getLeaseTermDisplayLabel({
        leaseEndDate: "2026-01-28",
        leaseStartDate: "2026-01-15",
        rentBillingCadence: RentBillingCadence.WEEKLY,
        termMonths: 1,
      })
    ).toBe("2 weeks");
  });

  test("shows month count for monthly leases", () => {
    expect(
      getLeaseTermDisplayLabel({
        leaseEndDate: "2026-12-31",
        leaseStartDate: "2026-01-01",
        rentBillingCadence: RentBillingCadence.MONTHLY,
        termMonths: 12,
      })
    ).toBe("12 months");
  });
});

describe("getVisibleLeaseRentPeriods", () => {
  test("hides weekly bootstrap row matching lease start and base rent", () => {
    expect(
      getVisibleLeaseRentPeriods(
        {
          leaseStartDate: "2026-07-21",
          monthlyRent: 1000,
          rentBillingCadence: RentBillingCadence.WEEKLY,
        },
        [{ effectiveFromMonth: "2026-07-21", monthlyRent: 1000 }]
      )
    ).toEqual([]);
  });

  test("shows weekly rent changes", () => {
    expect(
      getVisibleLeaseRentPeriods(
        {
          leaseStartDate: "2026-07-21",
          monthlyRent: 1000,
          rentBillingCadence: RentBillingCadence.WEEKLY,
        },
        [
          { effectiveFromMonth: "2026-07-21", monthlyRent: 1000 },
          { effectiveFromMonth: "2026-08-04", monthlyRent: 1100 },
        ]
      )
    ).toHaveLength(2);
  });

  test("shows monthly rent history when effective month differs from start month", () => {
    expect(
      getVisibleLeaseRentPeriods(
        {
          leaseStartDate: "2026-01-15",
          monthlyRent: 1500,
          rentBillingCadence: RentBillingCadence.MONTHLY,
        },
        [{ effectiveFromMonth: "2026-07", monthlyRent: 1700 }]
      )
    ).toHaveLength(1);
  });
});

describe("getLeaseExtendTermsDescription", () => {
  test("describes weekly extend with optional rent change", () => {
    expect(getLeaseExtendTermsDescription(RentBillingCadence.WEEKLY)).toContain("weeks");
    expect(getLeaseExtendTermsDescription(RentBillingCadence.WEEKLY)).toContain("weekly rent");
  });
});
