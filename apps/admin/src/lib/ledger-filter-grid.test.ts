import { describe, expect, test } from "bun:test";

import { getLedgerFiltersGridClass } from "./ledger-filter-grid";

describe("getLedgerFiltersGridClass", () => {
  test("returns two-column base for small filter sets", () => {
    expect(getLedgerFiltersGridClass(2)).toBe("grid min-w-0 gap-3 sm:grid-cols-2");
  });

  test("returns three-column layout at lg for medium filter sets", () => {
    expect(getLedgerFiltersGridClass(3)).toBe("grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3");
  });

  test("returns xl four-column layout for four filters", () => {
    expect(getLedgerFiltersGridClass(4)).toBe(
      "grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    );
  });

  test("defers five filters to 2xl", () => {
    expect(getLedgerFiltersGridClass(5)).toBe(
      "grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
    );
  });

  test("defers six filters to 2xl", () => {
    expect(getLedgerFiltersGridClass(6)).toBe(
      "grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
    );
  });
});
