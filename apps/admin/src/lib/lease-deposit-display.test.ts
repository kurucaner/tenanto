import { describe, expect, test } from "bun:test";

import { LeaseDepositBalanceStatus } from "@/packages/shared";

import {
  canShowRecordLeaseDepositCta,
  formatLeaseDepositBalanceStatusLabel,
  formatLeaseSecurityDepositDisplay,
  getLeaseDepositBalanceRows,
  getLeaseDepositFormDefaults,
} from "./lease-deposit-display";

describe("formatLeaseSecurityDepositDisplay", () => {
  test("shows None when deposit is null or undefined", () => {
    expect(formatLeaseSecurityDepositDisplay(null)).toBe("None");
    expect(formatLeaseSecurityDepositDisplay(undefined)).toBe("None");
  });

  test("formats a positive deposit amount", () => {
    expect(formatLeaseSecurityDepositDisplay(1500)).toBe("$1,500.00");
  });

  test("formats zero deposit", () => {
    expect(formatLeaseSecurityDepositDisplay(0)).toBe("$0.00");
  });
});

describe("getLeaseDepositFormDefaults", () => {
  test("maps null deposit to none", () => {
    expect(getLeaseDepositFormDefaults({ rentAmount: 1500, securityDepositAmount: null })).toEqual({
      securityDepositCustomAmount: "",
      securityDepositPreset: "none",
    });
  });

  test("maps amount matching rent to one_month_rent", () => {
    expect(getLeaseDepositFormDefaults({ rentAmount: 1500, securityDepositAmount: 1500 })).toEqual({
      securityDepositCustomAmount: "",
      securityDepositPreset: "one_month_rent",
    });
  });

  test("maps other amounts to custom with the stored value", () => {
    expect(getLeaseDepositFormDefaults({ rentAmount: 1500, securityDepositAmount: 2000 })).toEqual({
      securityDepositCustomAmount: "2000",
      securityDepositPreset: "custom",
    });
  });
});

describe("canShowRecordLeaseDepositCta", () => {
  test("hides when expected is null", () => {
    expect(
      canShowRecordLeaseDepositCta({
        collected: 0,
        expected: null,
        outstanding: 0,
        status: LeaseDepositBalanceStatus.NONE,
      })
    ).toBe(false);
  });

  test("hides when fully collected", () => {
    expect(
      canShowRecordLeaseDepositCta({
        collected: 1500,
        expected: 1500,
        outstanding: 0,
        status: LeaseDepositBalanceStatus.HELD,
      })
    ).toBe(false);
  });

  test("shows when due or partial", () => {
    expect(
      canShowRecordLeaseDepositCta({
        collected: 0,
        expected: 1500,
        outstanding: 1500,
        status: LeaseDepositBalanceStatus.DUE,
      })
    ).toBe(true);
    expect(
      canShowRecordLeaseDepositCta({
        collected: 500,
        expected: 1500,
        outstanding: 1000,
        status: LeaseDepositBalanceStatus.PARTIAL,
      })
    ).toBe(true);
  });
});

describe("formatLeaseDepositBalanceStatusLabel", () => {
  test("maps each status to a short label", () => {
    expect(formatLeaseDepositBalanceStatusLabel(LeaseDepositBalanceStatus.DUE)).toBe("Due");
    expect(formatLeaseDepositBalanceStatusLabel(LeaseDepositBalanceStatus.HELD)).toBe("Held");
    expect(formatLeaseDepositBalanceStatusLabel(LeaseDepositBalanceStatus.REFUNDED)).toBe(
      "Refunded"
    );
  });
});

describe("getLeaseDepositBalanceRows", () => {
  test("formats expected collected and outstanding", () => {
    expect(
      getLeaseDepositBalanceRows({
        collected: 500,
        expected: 1500,
        outstanding: 1000,
        status: LeaseDepositBalanceStatus.PARTIAL,
      })
    ).toEqual({
      collectedLabel: "$500.00",
      expectedLabel: "$1,500.00",
      outstandingLabel: "$1,000.00",
    });
  });
});
