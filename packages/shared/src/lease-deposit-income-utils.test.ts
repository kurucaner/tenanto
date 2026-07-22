import { describe, expect, test } from "bun:test";

import {
  excludeDepositOtherIncomeRows,
  filterOutDepositIncomeLines,
  isDepositIncomeLine,
  isDepositIncomeLineType,
  sqlIsSecurityDepositIncomeLineType,
} from "./lease-deposit-income-utils";
import {
  isSystemSecurityDepositIncomeLineTypeName,
  SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
  SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME,
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

describe("isDepositIncomeLine", () => {
  test("returns true when incomeLineTypeName is Security deposit", () => {
    expect(
      isDepositIncomeLine({ incomeLineTypeName: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME })
    ).toBe(true);
  });

  test("returns false when type name is missing or not deposit", () => {
    expect(isDepositIncomeLine({ incomeLineTypeName: null })).toBe(false);
    expect(isDepositIncomeLine({})).toBe(false);
    expect(isDepositIncomeLine({ incomeLineTypeName: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME })).toBe(
      false
    );
  });
});

describe("excludeDepositOtherIncomeRows", () => {
  test("removes Security deposit rows from other-income breakdown", () => {
    expect(
      excludeDepositOtherIncomeRows([
        { amount: 1500, name: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME },
        { amount: 200, name: "Late fee" },
      ])
    ).toEqual([{ amount: 200, name: "Late fee" }]);
  });
});

describe("filterOutDepositIncomeLines", () => {
  test("keeps rent lines and drops deposit lines", () => {
    expect(
      filterOutDepositIncomeLines([
        { id: "rent", incomeLineTypeName: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME },
        { id: "deposit", incomeLineTypeName: SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME },
      ])
    ).toEqual([{ id: "rent", incomeLineTypeName: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME }]);
  });
});

describe("sqlIsSecurityDepositIncomeLineType", () => {
  test("builds a lower() equality predicate against the system name", () => {
    expect(sqlIsSecurityDepositIncomeLineType()).toBe(
      `lower(ilt.name) = lower('${SYSTEM_SECURITY_DEPOSIT_INCOME_TYPE_NAME}')`
    );
  });
});
