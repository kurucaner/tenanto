import { describe, expect, test } from "bun:test";

import { buildIncomeImportDuplicateCheckFilters } from "./income-import-duplicate-check-filters";

describe("buildIncomeImportDuplicateCheckFilters", () => {
  test("returns limit-only filters when there are no preview rows", () => {
    expect(buildIncomeImportDuplicateCheckFilters([])).toEqual({ limit: 50 });
  });

  test("bounds the query to the import row date span with padding", () => {
    expect(
      buildIncomeImportDuplicateCheckFilters([
        { checkIn: "2026-03-10", checkOut: "2026-03-12", guestName: "A", unitId: "u1" },
        { checkIn: "2026-03-05", checkOut: "2026-03-20", guestName: "B", unitId: "u2" },
      ])
    ).toEqual({
      from: "2026-03-02",
      limit: 50,
      to: "2026-03-23",
    });
  });
});
