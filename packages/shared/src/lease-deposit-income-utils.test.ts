import { describe, expect, test } from "bun:test";

import {
  isDepositIncomeLineType,
  SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
} from "./lease-deposit-income-utils";
import {
  isSystemSecurityDepositIncomeLineTypeName,
  SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
} from "./property-income-line-type-config";

describe("SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME", () => {
  test("is Security deposit", () => {
    expect(SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME).toBe("Security deposit");
  });
});

describe("isSystemSecurityDepositIncomeLineTypeName", () => {
  test("matches Security deposit case-insensitively", () => {
    expect(isSystemSecurityDepositIncomeLineTypeName(SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME)).toBe(
      true
    );
    expect(isSystemSecurityDepositIncomeLineTypeName("security deposit")).toBe(true);
  });

  test("returns false for rent and misc names", () => {
    expect(isSystemSecurityDepositIncomeLineTypeName(SYSTEM_LEASE_RENT_INCOME_TYPE_NAME)).toBe(
      false
    );
    expect(isSystemSecurityDepositIncomeLineTypeName("Extra cleaning")).toBe(false);
  });
});

describe("isDepositIncomeLineType", () => {
  test("returns true for security deposit type names", () => {
    expect(isDepositIncomeLineType({ name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME })).toBe(true);
    expect(isDepositIncomeLineType({ name: "security deposit" })).toBe(true);
  });

  test("returns false for non-deposit type names", () => {
    expect(isDepositIncomeLineType({ name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME })).toBe(false);
    expect(isDepositIncomeLineType({ name: "Extra cleaning" })).toBe(false);
  });
});
