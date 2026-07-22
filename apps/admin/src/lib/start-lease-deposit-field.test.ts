import { describe, expect, test } from "bun:test";

import {
  LeaseDepositPreset,
  normalizeStartLeaseDepositPreset,
  resolveStartLeaseSecurityDepositAmount,
  START_LEASE_DEPOSIT_PRESET_LABELS,
} from "./start-lease-deposit-field";

describe("START_LEASE_DEPOSIT_PRESET_LABELS", () => {
  test("uses 1× rent amount for the rent snapshot preset", () => {
    expect(START_LEASE_DEPOSIT_PRESET_LABELS[LeaseDepositPreset.ONE_MONTH_RENT]).toBe(
      "1× rent amount"
    );
  });
});

describe("normalizeStartLeaseDepositPreset", () => {
  test("defaults invalid values to none", () => {
    expect(normalizeStartLeaseDepositPreset("nope")).toBe(LeaseDepositPreset.NONE);
    expect(normalizeStartLeaseDepositPreset(LeaseDepositPreset.CUSTOM)).toBe(
      LeaseDepositPreset.CUSTOM
    );
  });
});

describe("resolveStartLeaseSecurityDepositAmount", () => {
  test("none resolves to null", () => {
    expect(
      resolveStartLeaseSecurityDepositAmount({
        rentAmount: "1500",
        securityDepositCustomAmount: "100",
        securityDepositPreset: LeaseDepositPreset.NONE,
      })
    ).toBeNull();
  });

  test("one_month_rent snapshots the rent field for weekly and monthly", () => {
    expect(
      resolveStartLeaseSecurityDepositAmount({
        rentAmount: "700",
        securityDepositCustomAmount: "",
        securityDepositPreset: LeaseDepositPreset.ONE_MONTH_RENT,
      })
    ).toBe(700);
  });

  test("custom uses the custom amount", () => {
    expect(
      resolveStartLeaseSecurityDepositAmount({
        rentAmount: "1500",
        securityDepositCustomAmount: "2000.5",
        securityDepositPreset: LeaseDepositPreset.CUSTOM,
      })
    ).toBe(2000.5);
  });
});
