import { describe, expect, test } from "bun:test";

import { LeaseDepositBalanceStatus } from "./lease-deposit-balance-utils";
import {
  getEndLeaseDepositCalloutMessage,
  getLeaseDepositCloseOutCopy,
  needsLeaseDepositCloseOut,
} from "./lease-deposit-close-out-utils";

describe("needsLeaseDepositCloseOut", () => {
  test("true when deposit is held", () => {
    expect(
      needsLeaseDepositCloseOut({
        collected: 1500,
        expected: 1500,
        outstanding: 0,
        status: LeaseDepositBalanceStatus.HELD,
      })
    ).toBe(true);
  });

  test("true when partial collection exists", () => {
    expect(
      needsLeaseDepositCloseOut({
        collected: 500,
        expected: 1500,
        outstanding: 1000,
        status: LeaseDepositBalanceStatus.PARTIAL,
      })
    ).toBe(true);
  });

  test("false when nothing collected or already refunded", () => {
    expect(
      needsLeaseDepositCloseOut({
        collected: 0,
        expected: 1500,
        outstanding: 1500,
        status: LeaseDepositBalanceStatus.DUE,
      })
    ).toBe(false);
    expect(
      needsLeaseDepositCloseOut({
        collected: 1500,
        expected: 1500,
        outstanding: 0,
        status: LeaseDepositBalanceStatus.REFUNDED,
      })
    ).toBe(false);
    expect(
      needsLeaseDepositCloseOut({
        collected: 0,
        expected: null,
        outstanding: 0,
        status: LeaseDepositBalanceStatus.NONE,
      })
    ).toBe(false);
  });
});

describe("getEndLeaseDepositCalloutMessage", () => {
  test("returns null when close-out is not needed", () => {
    expect(
      getEndLeaseDepositCalloutMessage({
        collected: 0,
        expected: null,
        outstanding: 0,
        status: LeaseDepositBalanceStatus.NONE,
      })
    ).toBeNull();
  });

  test("returns guidance when deposit is held", () => {
    const message = getEndLeaseDepositCalloutMessage({
      collected: 1500,
      expected: 1500,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.HELD,
    });
    expect(message).toContain("security deposit is held");
    expect(message).toContain("Income");
  });
});

describe("getLeaseDepositCloseOutCopy", () => {
  test("includes refund and withhold guidance", () => {
    const copy = getLeaseDepositCloseOutCopy({
      collected: 1500,
      expected: 1500,
      outstanding: 0,
      status: LeaseDepositBalanceStatus.HELD,
    });
    expect(copy.title).toBe("Settle security deposit");
    expect(copy.body).toContain("refund");
    expect(copy.body).toContain("withhold");
    expect(copy.incomeCtaLabel).toBe("Open Income");
  });
});
