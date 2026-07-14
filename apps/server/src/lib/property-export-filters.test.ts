import { describe, expect, test } from "bun:test";

import {
  normalizeExpenseExportFilters,
  serializeExpenseExportFilters,
} from "./property-export-filters";

describe("normalizeExpenseExportFilters", () => {
  test("drops empty values and trims search", () => {
    expect(
      normalizeExpenseExportFilters({
        categoryId: "",
        from: "2026-01-01",
        q: "  utilities  ",
        to: "2026-01-31",
      })
    ).toEqual({
      from: "2026-01-01",
      q: "utilities",
      to: "2026-01-31",
    });
  });

  test("serializes equivalent filters to the same JSON", () => {
    const left = serializeExpenseExportFilters({
      from: "2026-01-01",
      q: "utilities",
      to: "2026-01-31",
    });
    const right = serializeExpenseExportFilters({
      categoryId: "",
      from: "2026-01-01",
      q: "  utilities  ",
      to: "2026-01-31",
    });

    expect(left).toBe(right);
  });
});
