import { describe, expect, test } from "bun:test";

import { DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES } from "@/packages/shared";

describe("DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES", () => {
  test("includes core default categories", () => {
    const names = DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES.map((t) => t.name.toLowerCase());
    expect(names).toContain("other");
  });

  test("marks annual amount categories correctly", () => {
    const annuals = DEFAULT_PROPERTY_EXPENSE_CATEGORY_TYPES.filter((t) => t.isAnnualAmount);
    expect(annuals.length).toBeGreaterThan(0);
  });
});
