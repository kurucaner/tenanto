import { describe, expect, test } from "bun:test";

import { RentBillingCadence } from "@/packages/shared";
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
          rentPeriodKey: "2026-01",
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
          rentPeriodKey: "2026-01",
          transactionDate: "2026-01-20",
          updatedAt: "2026-01-20T00:00:00.000Z",
        }),
      ],
      lease: {
        leaseStartDate: "2026-01-01",
        rentAmount: 1500,
        rentBillingCadence: RentBillingCadence.MONTHLY,
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
          rentPeriodKey: "2026-01",
          transactionDate: "2026-01-10",
          updatedAt: "2026-01-10T00:00:00.000Z",
        }),
      ],
      lease: {
        leaseStartDate: "2026-01-01",
        rentAmount: 1500,
        rentBillingCadence: RentBillingCadence.MONTHLY,
      },
      months: ["2026-01"],
      rentPeriods: [],
    });

    expect(schedule[0]).toMatchObject({
      expectedRent: 1500,
      incomeLineId: "line-manual",
      isPaid: false,
      month: "2026-01",
      paidRent: 1000,
      periodKey: "2026-01",
      remainingRent: 500,
    });
  });

  test("builds weekly schedule with week-start keys and proration", () => {
    const schedule = buildLeaseRentScheduleWithRollup({
      allocationCentsByMonth: new Map(),
      effectiveEndDate: "2026-02-10",
      incomeLines: [
        makeIncomeLine({
          amount: 700,
          createdAt: "2026-01-20T00:00:00.000Z",
          grossIncome: 700,
          id: "line-week-1",
          incomeLineTypeId: "type-rent",
          longStayId: "lease-weekly",
          netIncome: 700,
          rentPeriodKey: "2026-01-15",
          transactionDate: "2026-01-20",
          updatedAt: "2026-01-20T00:00:00.000Z",
        }),
      ],
      lease: {
        leaseStartDate: "2026-01-15",
        rentAmount: 700,
        rentBillingCadence: RentBillingCadence.WEEKLY,
      },
      months: ["2026-01-15", "2026-01-22", "2026-01-29", "2026-02-05"],
      rentPeriods: [],
    });

    expect(schedule).toHaveLength(4);
    expect(schedule[0]).toMatchObject({
      expectedRent: 700,
      incomeLineId: "line-week-1",
      isPaid: true,
      isProrated: false,
      month: "2026-01-15",
      occupiedDays: 7,
      paidRent: 700,
      remainingRent: 0,
    });
    expect(schedule[3]).toMatchObject({
      expectedRent: 600,
      isPaid: false,
      isProrated: true,
      month: "2026-02-05",
      occupiedDays: 6,
      paidRent: 0,
      remainingRent: 600,
    });
  });

  test("builds weekly schedule with mid-lease rent period change", () => {
    const schedule = buildLeaseRentScheduleWithRollup({
      allocationCentsByMonth: new Map(),
      effectiveEndDate: "2026-02-10",
      incomeLines: [],
      lease: {
        leaseStartDate: "2026-01-15",
        rentAmount: 700,
        rentBillingCadence: RentBillingCadence.WEEKLY,
      },
      months: ["2026-01-15", "2026-01-22", "2026-01-29", "2026-02-05"],
      rentPeriods: [
        { effectiveFromPeriod: "2026-01-15", rentAmount: 700 },
        { effectiveFromPeriod: "2026-01-29", rentAmount: 800 },
      ],
    });

    expect(schedule[0]?.expectedRent).toBe(700);
    expect(schedule[1]?.expectedRent).toBe(700);
    expect(schedule[2]?.expectedRent).toBe(800);
    expect(schedule[3]).toMatchObject({
      expectedRent: 685.71,
      isProrated: true,
      month: "2026-02-05",
    });
  });
});
