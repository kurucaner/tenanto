import { describe, expect, test } from "bun:test";

import { makeIncomeLine } from "@/test-fixtures/domain";

import { buildLeaseRentScheduleWithRollup } from "./build-lease-rent-schedule-with-rollup";

describe("buildLeaseRentScheduleWithRollup", () => {
  test("incomeLineId is the first reportable line for display; paidRent sums all lines", () => {
    const schedule = buildLeaseRentScheduleWithRollup({
      allocationCentsByMonth: new Map(),
      effectiveEndDate: "2026-01-31",
      incomeLines: [
        makeIncomeLine({
          amount: 750,
          createdAt: "2026-01-10T00:00:00.000Z",
          grossIncome: 750,
          id: "line-a",
          incomeLineTypeId: "type-rent",
          longStayId: "lease-1",
          netIncome: 750,
          rentPeriodMonth: "2026-01",
          transactionDate: "2026-01-10",
          updatedAt: "2026-01-10T00:00:00.000Z",
        }),
        makeIncomeLine({
          amount: 750,
          createdAt: "2026-01-20T00:00:00.000Z",
          grossIncome: 750,
          id: "line-b",
          incomeLineTypeId: "type-rent",
          longStayId: "lease-1",
          netIncome: 750,
          rentPeriodMonth: "2026-01",
          transactionDate: "2026-01-20",
          updatedAt: "2026-01-20T00:00:00.000Z",
        }),
      ],
      lease: {
        leaseStartDate: "2026-01-01",
        monthlyRent: 1500,
      },
      months: ["2026-01"],
      rentPeriods: [],
    });

    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({
      expectedRent: 1500,
      incomeLineId: "line-a",
      isPaid: true,
      month: "2026-01",
      paidRent: 1500,
      remainingRent: 0,
    });
  });

  test("combines manual income and Stripe allocations in schedule rollup", () => {
    const schedule = buildLeaseRentScheduleWithRollup({
      allocationCentsByMonth: new Map([["2026-01", 50_000]]),
      effectiveEndDate: "2026-01-31",
      incomeLines: [
        makeIncomeLine({
          amount: 500,
          createdAt: "2026-01-10T00:00:00.000Z",
          grossIncome: 500,
          id: "line-manual",
          incomeLineTypeId: "type-rent",
          longStayId: "lease-1",
          netIncome: 500,
          rentPeriodMonth: "2026-01",
          transactionDate: "2026-01-10",
          updatedAt: "2026-01-10T00:00:00.000Z",
        }),
      ],
      lease: {
        leaseStartDate: "2026-01-01",
        monthlyRent: 1500,
      },
      months: ["2026-01"],
      rentPeriods: [],
    });

    expect(schedule[0]).toMatchObject({
      expectedRent: 1500,
      incomeLineId: "line-manual",
      isPaid: false,
      paidRent: 1000,
      remainingRent: 500,
    });
  });
});
