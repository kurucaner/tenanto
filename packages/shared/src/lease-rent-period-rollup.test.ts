import { describe, expect, test } from "bun:test";

import {
  getEffectiveRentPeriodKey,
  type ILeaseRentPeriodIncomeLineInput,
  isLeaseRentMonthFullyPaid,
  rollupLeaseRentByPeriod,
} from "./lease-rent-period-rollup";

const BASE_LINE: ILeaseRentPeriodIncomeLineInput = {
  amount: 1500,
  channelCommission: 0,
  grossIncome: 1500,
  isDeleted: false,
  netIncome: 1500,
  refundedAmount: null,
  refundedAt: null,
  rentPeriodKey: null,
  taxBreakdown: [],
  transactionDate: "2026-03-15",
};

function incomeLine(
  overrides: Partial<ILeaseRentPeriodIncomeLineInput> = {}
): ILeaseRentPeriodIncomeLineInput {
  return { ...BASE_LINE, ...overrides };
}

describe("getEffectiveRentPeriodKey", () => {
  test("uses rentPeriodKey when valid", () => {
    expect(
      getEffectiveRentPeriodKey({
        rentPeriodKey: "2026-02",
        transactionDate: "2026-03-15",
      })
    ).toBe("2026-02");
  });

  test("falls back to transactionDate month when rentPeriodKey is null", () => {
    expect(
      getEffectiveRentPeriodKey({
        rentPeriodKey: null,
        transactionDate: "2026-03-15",
      })
    ).toBe("2026-03");
  });

  test("falls back to transactionDate month when rentPeriodKey is invalid", () => {
    expect(
      getEffectiveRentPeriodKey({
        rentPeriodKey: "not-a-month",
        transactionDate: "2026-03-15",
      })
    ).toBe("2026-03");
  });

  test("resolves weekly period from schedule when rentPeriodKey is omitted", () => {
    expect(
      getEffectiveRentPeriodKey({
        rentPeriodKey: null,
        schedulePeriods: ["2026-01-15", "2026-01-22"],
        transactionDate: "2026-01-20",
      })
    ).toBe("2026-01-15");
  });

  test("accepts legacy rentPeriodMonth when rentPeriodKey is omitted", () => {
    expect(
      getEffectiveRentPeriodKey({
        rentPeriodMonth: "2026-02",
        transactionDate: "2026-03-15",
      })
    ).toBe("2026-02");
  });
});

describe("isLeaseRentMonthFullyPaid", () => {
  test("returns true when paid meets expected within tolerance", () => {
    expect(isLeaseRentMonthFullyPaid(1500, 1499.99)).toBe(true);
    expect(isLeaseRentMonthFullyPaid(1500, 1500)).toBe(true);
  });

  test("returns false when materially underpaid", () => {
    expect(isLeaseRentMonthFullyPaid(1500, 500)).toBe(false);
  });
});

describe("rollupLeaseRentByPeriod", () => {
  const schedule = [{ expectedRent: 1500, periodKey: "2026-03" }];

  test("returns zero paid and full remaining when no payments", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [],
      scheduleMonths: schedule,
    });

    expect(period).toEqual({
      expectedRent: 1500,
      isPaid: false,
      month: "2026-03",
      paidRent: 0,
      periodKey: "2026-03",
      remainingRent: 1500,
    });
  });

  test("returns partial paid state", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [incomeLine({ amount: 500, grossIncome: 500, netIncome: 500 })],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(500);
    expect(period?.remainingRent).toBe(1000);
    expect(period?.isPaid).toBe(false);
  });

  test("returns fully paid when income covers expected rent", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [incomeLine()],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1500);
    expect(period?.remainingRent).toBe(0);
    expect(period?.isPaid).toBe(true);
  });

  test("sums multiple income lines for the same period", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [
        incomeLine({ amount: 500, grossIncome: 500, netIncome: 500 }),
        incomeLine({ amount: 1000, grossIncome: 1000, netIncome: 1000 }),
      ],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1500);
    expect(period?.isPaid).toBe(true);
  });

  test("attributes income via rentPeriodKey when set", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [
        incomeLine({
          amount: 1500,
          grossIncome: 1500,
          netIncome: 1500,
          rentPeriodKey: "2026-03",
          transactionDate: "2026-04-05",
        }),
      ],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1500);
    expect(period?.isPaid).toBe(true);
  });

  test("reduces paid amount after partial refund", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [
        incomeLine({
          amount: 1500,
          grossIncome: 1500,
          netIncome: 1500,
          refundedAmount: 1000,
          refundedAt: "2026-03-20T00:00:00.000Z",
        }),
      ],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(500);
    expect(period?.remainingRent).toBe(1000);
    expect(period?.isPaid).toBe(false);
  });

  test("returns zero paid after full refund", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [
        incomeLine({
          amount: 1500,
          grossIncome: 1500,
          netIncome: 1500,
          refundedAmount: 1500,
          refundedAt: "2026-03-20T00:00:00.000Z",
        }),
      ],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(0);
    expect(period?.remainingRent).toBe(1500);
    expect(period?.isPaid).toBe(false);
  });

  test("restores full paid amount after unrefund clears refund fields", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [incomeLine()],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1500);
    expect(period?.isPaid).toBe(true);
  });

  test("two $750 lines with the same rentPeriodKey fully pay the month", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [
        incomeLine({
          amount: 750,
          grossIncome: 750,
          netIncome: 750,
          rentPeriodKey: "2026-03",
          transactionDate: "2026-03-05",
        }),
        incomeLine({
          amount: 750,
          grossIncome: 750,
          netIncome: 750,
          rentPeriodKey: "2026-03",
          transactionDate: "2026-03-20",
        }),
      ],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1500);
    expect(period?.remainingRent).toBe(0);
    expect(period?.isPaid).toBe(true);
  });

  test("ignores deleted income lines when summing a period", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [
        incomeLine({
          amount: 750,
          grossIncome: 750,
          isDeleted: true,
          netIncome: 750,
          rentPeriodKey: "2026-03",
        }),
        incomeLine({
          amount: 750,
          grossIncome: 750,
          netIncome: 750,
          rentPeriodKey: "2026-03",
        }),
      ],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(750);
    expect(period?.isPaid).toBe(false);
  });

  test("combines manual income and Stripe allocations for partial paid state", () => {
    const [period] = rollupLeaseRentByPeriod({
      allocations: [{ allocatedCents: 50_000, periodKey: "2026-03" }],
      incomeLines: [incomeLine({ amount: 500, grossIncome: 500, netIncome: 500 })],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1000);
    expect(period?.remainingRent).toBe(500);
    expect(period?.isPaid).toBe(false);
  });

  test("caps combined manual income and Stripe allocations at expected rent", () => {
    const [period] = rollupLeaseRentByPeriod({
      allocations: [{ allocatedCents: 100_000, periodKey: "2026-03" }],
      incomeLines: [incomeLine({ amount: 1000, grossIncome: 1000, netIncome: 1000 })],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1500);
    expect(period?.remainingRent).toBe(0);
    expect(period?.isPaid).toBe(true);
  });

  test("sums multiple Stripe allocations for the same period", () => {
    const [period] = rollupLeaseRentByPeriod({
      allocations: [
        { allocatedCents: 25_000, periodKey: "2026-03" },
        { allocatedCents: 25_000, periodKey: "2026-03" },
      ],
      incomeLines: [],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(500);
    expect(period?.remainingRent).toBe(1000);
    expect(period?.isPaid).toBe(false);
  });

  test("includes succeeded Stripe allocations in paid total", () => {
    const [period] = rollupLeaseRentByPeriod({
      allocations: [{ allocatedCents: 50_000, periodKey: "2026-03" }],
      incomeLines: [incomeLine({ amount: 1000, grossIncome: 1000, netIncome: 1000 })],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1500);
    expect(period?.isPaid).toBe(true);
  });

  test("caps paid rent at expected rent when overpaid", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [incomeLine({ amount: 2000, grossIncome: 2000, netIncome: 2000 })],
      scheduleMonths: schedule,
    });

    expect(period?.paidRent).toBe(1500);
    expect(period?.remainingRent).toBe(0);
    expect(period?.isPaid).toBe(true);
  });

  test("treats paid within tolerance as fully paid with zero remaining", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [incomeLine({ amount: 1499.99, grossIncome: 1499.99, netIncome: 1499.99 })],
      scheduleMonths: schedule,
    });

    expect(period).toMatchObject({
      expectedRent: 1500,
      isPaid: true,
      paidRent: 1499.99,
      remainingRent: 0,
    });
  });

  test("keeps partial state when paid is materially under expected", () => {
    const [period] = rollupLeaseRentByPeriod({
      incomeLines: [incomeLine({ amount: 1499.98, grossIncome: 1499.98, netIncome: 1499.98 })],
      scheduleMonths: schedule,
    });

    expect(period).toMatchObject({
      isPaid: false,
      paidRent: 1499.98,
      remainingRent: 0.02,
    });
  });
});
