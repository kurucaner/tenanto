import { describe, expect, test } from "bun:test";

import {
  DEFAULT_RENT_TYPE_NAME,
  isRentIncomeLineType,
  resolveLeaseIncomeLineTypeId,
} from "./property-income-line-type-config";

describe("isRentIncomeLineType", () => {
  test("returns true for rent type names regardless of casing", () => {
    expect(isRentIncomeLineType({ name: DEFAULT_RENT_TYPE_NAME })).toBe(true);
    expect(isRentIncomeLineType({ name: "rent" })).toBe(true);
    expect(isRentIncomeLineType({ name: "RENT" })).toBe(true);
  });

  test("returns false for non-rent type names", () => {
    expect(isRentIncomeLineType({ name: "Extra cleaning" })).toBe(false);
  });
});

describe("resolveLeaseIncomeLineTypeId", () => {
  test("prefers Rent type by name", () => {
    expect(
      resolveLeaseIncomeLineTypeId([
        { id: "type-clean", name: "Extra cleaning" },
        { id: "type-rent", name: "Rent" },
      ])
    ).toBe("type-rent");
  });

  test("falls back to first type when Rent name is absent", () => {
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
