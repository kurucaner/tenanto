import { describe, expect, test } from "bun:test";

import { makeExpense } from "@/test-fixtures/domain";

import { buildExpensesExportFileName, mapExpenseToCsvValues } from "./expenses-csv-export";

describe("mapExpenseToCsvValues", () => {
  test("formats expense fields for CSV output", () => {
    expect(mapExpenseToCsvValues(makeExpense())).toEqual([
      "2026-03-10",
      "Maintenance",
      'Pipe repair, 1" fitting',
      "125.50",
      "No",
      "2026-03-15",
    ]);
  });

  test("handles null description and date", () => {
    expect(
      mapExpenseToCsvValues(
        makeExpense({
          description: null,
          expenseDate: null,
          cashExpense: true,
        })
      )
    ).toEqual(["", "Maintenance", "", "125.50", "Yes", "2026-03-15"]);
  });
});

describe("buildExpensesExportFileName", () => {
  test("uses filter dates in the filename", () => {
    expect(buildExpensesExportFileName({ from: "2026-01-01", to: "2026-03-31" })).toBe(
      "expenses-2026-01-01-2026-03-31.csv"
    );
  });

  test("falls back to all when dates are missing", () => {
    expect(buildExpensesExportFileName({})).toBe("expenses-all-all.csv");
  });
});
