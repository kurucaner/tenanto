import { describe, expect, test } from "bun:test";

import {
  getIncomeLineRefundableCap,
  getPartialRefundReportFactor,
  getReportableIncomeLineAmounts,
  getReportableStayAmounts,
  getStayRefundableCap,
  isFullyRefunded,
  isIncomeLinePaidForRentSchedule,
  validateRefundAmount,
} from "./property-partial-refund-utils";

const stayBase = {
  channelCommission: 30,
  channelCommissionRate: 0.1,
  cleaningFee: 50,
  grossIncome: 500,
  netIncome: 400,
  refundedAmount: null as number | null,
  refundedAt: null as string | null,
  roomTotal: 450,
  taxBreakdown: [
    {
      amount: 20,
      name: "Sales tax",
      rate: 0.04,
      taxRateId: "tax-1",
    },
  ],
};

const lineBase = {
  amount: 1500,
  channelCommission: 0,
  grossIncome: 1500,
  isDeleted: false,
  netIncome: 1500,
  refundedAmount: null as number | null,
  refundedAt: null as string | null,
  taxBreakdown: [] as typeof stayBase.taxBreakdown,
};

describe("getIncomeLineRefundableCap", () => {
  test("uses line amount", () => {
    expect(getIncomeLineRefundableCap({ amount: 75 })).toBe(75);
  });
});

describe("getStayRefundableCap", () => {
  test("uses gross income", () => {
    expect(getStayRefundableCap({ grossIncome: 500 })).toBe(500);
  });
});

describe("isFullyRefunded", () => {
  test("returns false when not refunded", () => {
    expect(isFullyRefunded(null, null, 500)).toBe(false);
  });

  test("returns true when refunded with null amount (legacy full refund)", () => {
    expect(isFullyRefunded("2026-03-01T00:00:00.000Z", null, 500)).toBe(true);
  });

  test("returns true when refunded amount equals cap", () => {
    expect(isFullyRefunded("2026-03-01T00:00:00.000Z", 500, 500)).toBe(true);
  });

  test("returns false for partial refund", () => {
    expect(isFullyRefunded("2026-03-01T00:00:00.000Z", 125, 500)).toBe(false);
  });

  test("treats zero cap as fully refunded when refund timestamp is set", () => {
    expect(isFullyRefunded("2026-03-01T00:00:00.000Z", null, 0)).toBe(true);
  });
});

describe("getPartialRefundReportFactor", () => {
  test("returns 1 when not refunded", () => {
    expect(getPartialRefundReportFactor(null, null, 500)).toBe(1);
  });

  test("returns 0 for full refund", () => {
    expect(getPartialRefundReportFactor("2026-03-01T00:00:00.000Z", 500, 500)).toBe(0);
    expect(getPartialRefundReportFactor("2026-03-01T00:00:00.000Z", null, 500)).toBe(0);
  });

  test("returns remaining share for partial refund", () => {
    expect(getPartialRefundReportFactor("2026-03-01T00:00:00.000Z", 125, 500)).toBeCloseTo(0.75);
  });
});

describe("getReportableStayAmounts", () => {
  test("returns original amounts when not refunded", () => {
    expect(getReportableStayAmounts(stayBase)).toEqual({
      channelCommission: 30,
      channelCommissionRate: 0.1,
      cleaningFee: 50,
      grossIncome: 500,
      netIncome: 400,
      roomTotal: 450,
      taxBreakdown: stayBase.taxBreakdown,
    });
  });

  test("returns zeros for full refund", () => {
    const reportable = getReportableStayAmounts({
      ...stayBase,
      refundedAmount: 500,
      refundedAt: "2026-03-01T00:00:00.000Z",
    });

    expect(reportable).toEqual({
      channelCommission: 0,
      channelCommissionRate: 0.1,
      cleaningFee: 0,
      grossIncome: 0,
      netIncome: 0,
      roomTotal: 0,
      taxBreakdown: [{ ...stayBase.taxBreakdown[0]!, amount: 0 }],
    });
  });

  test("scales all monetary fields proportionally for partial refund", () => {
    const reportable = getReportableStayAmounts({
      ...stayBase,
      refundedAmount: 250,
      refundedAt: "2026-03-01T00:00:00.000Z",
    });

    expect(reportable.grossIncome).toBe(250);
    expect(reportable.netIncome).toBe(200);
    expect(reportable.roomTotal).toBe(225);
    expect(reportable.cleaningFee).toBe(25);
    expect(reportable.channelCommission).toBe(15);
    expect(reportable.channelCommissionRate).toBe(0.1);
    expect(reportable.taxBreakdown[0]?.amount).toBe(10);
  });
});

describe("getReportableIncomeLineAmounts", () => {
  test("returns original amounts when not refunded", () => {
    expect(getReportableIncomeLineAmounts(lineBase)).toEqual({
      channelCommission: 0,
      grossIncome: 1500,
      netIncome: 1500,
      taxBreakdown: [],
    });
  });

  test("returns zeros for full refund", () => {
    expect(
      getReportableIncomeLineAmounts({
        ...lineBase,
        refundedAmount: 1500,
        refundedAt: "2026-03-01T00:00:00.000Z",
      })
    ).toEqual({
      channelCommission: 0,
      grossIncome: 0,
      netIncome: 0,
      taxBreakdown: [],
    });
  });

  test("scales amounts for partial refund", () => {
    expect(
      getReportableIncomeLineAmounts({
        ...lineBase,
        refundedAmount: 500,
        refundedAt: "2026-03-01T00:00:00.000Z",
      })
    ).toEqual({
      channelCommission: 0,
      grossIncome: 1000,
      netIncome: 1000,
      taxBreakdown: [],
    });
  });
});

describe("isIncomeLinePaidForRentSchedule", () => {
  test("returns false for deleted lines", () => {
    expect(isIncomeLinePaidForRentSchedule({ ...lineBase, isDeleted: true })).toBe(false);
  });

  test("returns false for fully refunded rent lines", () => {
    expect(
      isIncomeLinePaidForRentSchedule({
        ...lineBase,
        refundedAmount: 1500,
        refundedAt: "2026-03-01T00:00:00.000Z",
      })
    ).toBe(false);
  });

  test("returns true for partially refunded rent lines with remaining net income", () => {
    expect(
      isIncomeLinePaidForRentSchedule({
        ...lineBase,
        refundedAmount: 500,
        refundedAt: "2026-03-01T00:00:00.000Z",
      })
    ).toBe(true);
  });

  test("returns true for normal rent lines", () => {
    expect(isIncomeLinePaidForRentSchedule(lineBase)).toBe(true);
  });
});

describe("validateRefundAmount", () => {
  test("defaults to full refund when amount is omitted", () => {
    expect(validateRefundAmount(undefined, 500)).toEqual({ amount: 500, ok: true });
  });

  test("accepts valid partial amounts", () => {
    expect(validateRefundAmount({ amount: 125.5 }, 500)).toEqual({ amount: 125.5, ok: true });
  });

  test("rejects non-positive amounts", () => {
    expect(validateRefundAmount({ amount: 0 }, 500)).toEqual({
      error: "amount must be greater than zero",
      ok: false,
    });
  });

  test("rejects amounts above cap", () => {
    expect(validateRefundAmount({ amount: 500.01 }, 500)).toEqual({
      error: "amount cannot exceed 500",
      ok: false,
    });
  });

  test("rejects refund when cap is zero", () => {
    expect(validateRefundAmount(undefined, 0)).toEqual({
      error: "Cannot refund an entry with zero refundable amount",
      ok: false,
    });
  });
});
