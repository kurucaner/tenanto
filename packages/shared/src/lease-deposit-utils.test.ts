import { describe, expect, test } from "bun:test";

import {
  inferLeaseDepositPreset,
  isLeaseDepositPreset,
  LeaseDepositPreset,
  resolveSecurityDepositAmount,
  validateSecurityDepositAmount,
} from "./lease-deposit-utils";

describe("validateSecurityDepositAmount", () => {
  test("allows omit, null, and zero", () => {
    expect(validateSecurityDepositAmount(undefined)).toBeNull();
    expect(validateSecurityDepositAmount(null)).toBeNull();
    expect(validateSecurityDepositAmount(0)).toBeNull();
  });

  test("allows positive finite amounts", () => {
    expect(validateSecurityDepositAmount(1500)).toBeNull();
    expect(validateSecurityDepositAmount(1500.5)).toBeNull();
  });

  test("rejects negative and non-finite amounts", () => {
    expect(validateSecurityDepositAmount(-1)).toBe(
      "securityDepositAmount must be a non-negative number"
    );
    expect(validateSecurityDepositAmount(Number.NaN)).toBe(
      "securityDepositAmount must be a non-negative number"
    );
    expect(validateSecurityDepositAmount(Number.POSITIVE_INFINITY)).toBe(
      "securityDepositAmount must be a non-negative number"
    );
  });
});

describe("resolveSecurityDepositAmount", () => {
  test("none resolves to null", () => {
    expect(
      resolveSecurityDepositAmount({
        customAmount: 999,
        preset: LeaseDepositPreset.NONE,
        rentAmount: 2000,
      })
    ).toBeNull();
  });

  test("one_month_rent snapshots rent amount", () => {
    expect(
      resolveSecurityDepositAmount({
        preset: LeaseDepositPreset.ONE_MONTH_RENT,
        rentAmount: 2450.556,
      })
    ).toBe(2450.56);
  });

  test("one_month_rent with invalid rent returns null", () => {
    expect(
      resolveSecurityDepositAmount({
        preset: LeaseDepositPreset.ONE_MONTH_RENT,
        rentAmount: -10,
      })
    ).toBeNull();
  });

  test("custom uses custom amount when valid", () => {
    expect(
      resolveSecurityDepositAmount({
        customAmount: 500.004,
        preset: LeaseDepositPreset.CUSTOM,
        rentAmount: 2000,
      })
    ).toBe(500);
  });

  test("custom with missing or invalid amount returns null", () => {
    expect(
      resolveSecurityDepositAmount({
        preset: LeaseDepositPreset.CUSTOM,
        rentAmount: 2000,
      })
    ).toBeNull();
    expect(
      resolveSecurityDepositAmount({
        customAmount: null,
        preset: LeaseDepositPreset.CUSTOM,
        rentAmount: 2000,
      })
    ).toBeNull();
    expect(
      resolveSecurityDepositAmount({
        customAmount: -1,
        preset: LeaseDepositPreset.CUSTOM,
        rentAmount: 2000,
      })
    ).toBeNull();
  });
});

describe("inferLeaseDepositPreset", () => {
  test("null or undefined → none", () => {
    expect(inferLeaseDepositPreset(null, 2000)).toBe(LeaseDepositPreset.NONE);
    expect(inferLeaseDepositPreset(undefined, 2000)).toBe(LeaseDepositPreset.NONE);
  });

  test("amount matching rent → one_month_rent", () => {
    expect(inferLeaseDepositPreset(2000, 2000)).toBe(LeaseDepositPreset.ONE_MONTH_RENT);
    expect(inferLeaseDepositPreset(2000.004, 2000)).toBe(LeaseDepositPreset.ONE_MONTH_RENT);
  });

  test("other amounts → custom", () => {
    expect(inferLeaseDepositPreset(1500, 2000)).toBe(LeaseDepositPreset.CUSTOM);
    expect(inferLeaseDepositPreset(0, 2000)).toBe(LeaseDepositPreset.CUSTOM);
  });
});

describe("isLeaseDepositPreset", () => {
  test("recognizes known presets", () => {
    expect(isLeaseDepositPreset("none")).toBe(true);
    expect(isLeaseDepositPreset("one_month_rent")).toBe(true);
    expect(isLeaseDepositPreset("custom")).toBe(true);
    expect(isLeaseDepositPreset("other")).toBe(false);
    expect(isLeaseDepositPreset(null)).toBe(false);
  });
});
