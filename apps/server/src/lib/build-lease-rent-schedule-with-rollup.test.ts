import { describe, expect, test } from "bun:test";

import { buildLeaseRentScheduleWithRollup } from "./build-lease-rent-schedule-with-rollup";

describe("buildLeaseRentScheduleWithRollup", () => {
  test("incomeLineId is the first reportable line for display; paidRent sums all lines", () => {
    const schedule = buildLeaseRentScheduleWithRollup({
      allocationCentsByMonth: new Map(),
      effectiveEndDate: "2026-01-31",
      incomeLines: [
        {
          amount: 750,
          channelCommission: 0,
          createdAt: "2026-01-10T00:00:00.000Z",
          deletedAt: null,
          description: null,
          grossIncome: 750,
          guestName: null,
          id: "line-a",
          incomeLineTypeId: "type-rent",
          isDeleted: false,
          longStayId: "lease-1",
          netIncome: 750,
          propertyId: "prop-1",
          refundedAmount: null,
          refundedAt: null,
          refundedBy: null,
          rentPeriodMonth: "2026-01",
          reservationId: null,
          taxBreakdown: [],
          transactionDate: "2026-01-10",
          unitId: "unit-1",
          updatedAt: "2026-01-10T00:00:00.000Z",
        },
        {
          amount: 750,
          channelCommission: 0,
          createdAt: "2026-01-20T00:00:00.000Z",
          deletedAt: null,
          description: null,
          grossIncome: 750,
          guestName: null,
          id: "line-b",
          incomeLineTypeId: "type-rent",
          isDeleted: false,
          longStayId: "lease-1",
          netIncome: 750,
          propertyId: "prop-1",
          refundedAmount: null,
          refundedAt: null,
          refundedBy: null,
          rentPeriodMonth: "2026-01",
          reservationId: null,
          taxBreakdown: [],
          transactionDate: "2026-01-20",
          unitId: "unit-1",
          updatedAt: "2026-01-20T00:00:00.000Z",
        },
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
        {
          amount: 500,
          channelCommission: 0,
          createdAt: "2026-01-10T00:00:00.000Z",
          deletedAt: null,
          description: null,
          grossIncome: 500,
          guestName: null,
          id: "line-manual",
          incomeLineTypeId: "type-rent",
          isDeleted: false,
          longStayId: "lease-1",
          netIncome: 500,
          propertyId: "prop-1",
          refundedAmount: null,
          refundedAt: null,
          refundedBy: null,
          rentPeriodMonth: "2026-01",
          reservationId: null,
          taxBreakdown: [],
          transactionDate: "2026-01-10",
          unitId: "unit-1",
          updatedAt: "2026-01-10T00:00:00.000Z",
        },
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
