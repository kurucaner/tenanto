import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PROPERTY_INCOME_LINE_TYPES,
  DEFAULT_RENT_TYPE_NAME,
  isRentIncomeLineType,
  isSystemLeaseRentIncomeLineTypeName,
  resolveLeaseIncomeLineTypeId,
  SYSTEM_LEASE_RENT_INCOME_TYPE_NAME,
} from "./property-income-line-type-config";

describe("DEFAULT_PROPERTY_INCOME_LINE_TYPES", () => {
  test("seeds user misc types only without Rent", () => {
    const names = DEFAULT_PROPERTY_INCOME_LINE_TYPES.map((type) => type.name);
    expect(names).toEqual(["Extra cleaning", "Beach equipment rental"]);
    expect(names).not.toContain("Rent");
    expect(names).not.toContain(SYSTEM_LEASE_RENT_INCOME_TYPE_NAME);
  });
});

describe("isSystemLeaseRentIncomeLineTypeName", () => {
  test("matches Long-term rent case-insensitively", () => {
    expect(isSystemLeaseRentIncomeLineTypeName(SYSTEM_LEASE_RENT_INCOME_TYPE_NAME)).toBe(true);
    expect(isSystemLeaseRentIncomeLineTypeName("long-term rent")).toBe(true);
  });

  test("returns false for legacy Rent name", () => {
    expect(isSystemLeaseRentIncomeLineTypeName(DEFAULT_RENT_TYPE_NAME)).toBe(false);
  });
});

describe("isRentIncomeLineType", () => {
  test("returns true for system and legacy rent type names", () => {
    expect(isRentIncomeLineType({ name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME })).toBe(true);
    expect(isRentIncomeLineType({ name: DEFAULT_RENT_TYPE_NAME })).toBe(true);
    expect(isRentIncomeLineType({ name: "rent" })).toBe(true);
  });

  test("returns false for non-rent type names", () => {
    expect(isRentIncomeLineType({ name: "Extra cleaning" })).toBe(false);
  });
});

describe("resolveLeaseIncomeLineTypeId", () => {
  test("prefers Long-term rent system type name when present in list", () => {
    expect(
      resolveLeaseIncomeLineTypeId([
        { id: "type-clean", name: "Extra cleaning" },
        { id: "type-system", name: SYSTEM_LEASE_RENT_INCOME_TYPE_NAME },
      ])
    ).toBe("type-system");
  });

  test("prefers legacy Rent type by name when system name is absent", () => {
    expect(
      resolveLeaseIncomeLineTypeId([
        { id: "type-clean", name: "Extra cleaning" },
        { id: "type-rent", name: "Rent" },
      ])
    ).toBe("type-rent");
  });

  test("falls back to first type when rent names are absent", () => {
    expect(
      resolveLeaseIncomeLineTypeId([
        { id: "type-clean", name: "Extra cleaning" },
        { id: "type-beach", name: "Beach equipment rental" },
      ])
    ).toBe("type-clean");
  });

  test("matches Rent case-insensitively", () => {
    expect(resolveLeaseIncomeLineTypeId([{ id: "type-rent", name: "rent" }])).toBe("type-rent");
  });

  test("returns empty string when no types are configured", () => {
    expect(resolveLeaseIncomeLineTypeId([])).toBe("");
  });
});
