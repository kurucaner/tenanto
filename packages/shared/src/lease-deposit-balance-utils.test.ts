import { describe, expect, test } from "bun:test";

import { buildLeaseDepositSummary, LeaseDepositBalanceStatus } from "./lease-deposit-balance-utils";

describe("buildLeaseDepositSummary", () => {
  test("returns none when no expected deposit and no lines", () => {
    expect(buildLeaseDepositSummary({ expected: null, lines: [] })).toEqual({
      collected: 0,
      expected: null,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.NONE,
    });
  });

  test("returns due when expected is set and nothing collected", () => {
    expect(buildLeaseDepositSummary({ expected: 1500, lines: [] })).toEqual({
      collected: 0,
      expected: 1500,
      outstanding: 1500,
      status: LeaseDepositBalanceStatus.DUE,
    });
  });

  test("returns partial when collected is below expected", () => {
    expect(
      buildLeaseDepositSummary({
        expected: 1500,
        lines: [{ amount: 500, refundedAmount: null }],
      })
    ).toEqual({
      collected: 500,
      expected: 1500,
      outstanding: 1000,
      status: LeaseDepositBalanceStatus.PARTIAL,
    });
  });

  test("returns held when collected meets or exceeds expected", () => {
    expect(
      buildLeaseDepositSummary({
        expected: 1500,
        lines: [
          { amount: 1000, refundedAmount: null },
          { amount: 500, refundedAmount: null },
        ],
      })
    ).toEqual({
      collected: 1500,
      expected: 1500,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.HELD,
    });
  });

  test("returns refunded when any line has a refund", () => {
    expect(
      buildLeaseDepositSummary({
        expected: 1500,
        lines: [{ amount: 1500, refundedAmount: 1500, refundedAt: "2026-07-01T00:00:00.000Z" }],
      })
    ).toEqual({
      collected: 1500,
      expected: 1500,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.REFUNDED,
    });
  });

  test("treats partial refund as refunded status", () => {
    expect(
      buildLeaseDepositSummary({
        expected: 1500,
        lines: [{ amount: 1500, refundedAmount: 200, refundedAt: "2026-07-01T00:00:00.000Z" }],
      })
    ).toMatchObject({
      collected: 1500,
      status: LeaseDepositBalanceStatus.REFUNDED,
    });
  });

  test("sums multiple deposit lines for collected", () => {
    const summary = buildLeaseDepositSummary({
      expected: 2000,
      lines: [
        { amount: 750.25, refundedAmount: null },
        { amount: 249.75, refundedAmount: null },
      ],
    });
    expect(summary.collected).toBe(1000);
    expect(summary.outstanding).toBe(1000);
    expect(summary.status).toBe(LeaseDepositBalanceStatus.PARTIAL);
  });

  test("held when collections exist without contractual expected", () => {
    expect(
      buildLeaseDepositSummary({
        expected: null,
        lines: [{ amount: 500, refundedAmount: null }],
      })
    ).toEqual({
      collected: 500,
      expected: null,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.HELD,
    });
  });
});
