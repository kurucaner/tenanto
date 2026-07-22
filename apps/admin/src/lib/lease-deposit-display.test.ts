import { describe, expect, test } from "bun:test";

import {
  formatLeaseSecurityDepositDisplay,
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
