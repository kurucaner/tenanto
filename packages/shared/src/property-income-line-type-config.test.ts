import { describe, expect, test } from "bun:test";

import {
  DEFAULT_RENT_TYPE_NAME,
  isRentIncomeLineType,
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
