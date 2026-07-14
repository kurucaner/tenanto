import { describe, expect, test } from "bun:test";

import { type IPropertyExpense } from "@/packages/shared";

import { buildExpensesExportFileName, mapExpenseToCsvValues } from "./expenses-csv-export";

function makeExpense(overrides: Partial<IPropertyExpense> = {}): IPropertyExpense {
  return {
    amount: 125.5,
    categoryId: "cat-1",
    categoryIsAnnualAmount: false,
    categoryName: "Maintenance",
    createdAt: "2026-03-15T10:00:00.000Z",
    deletedAt: null,
    description: 'Pipe repair, 1" fitting',
    expenseDate: "2026-03-10",
    id: "expense-1",
    isDeleted: false,
    propertyId: "property-1",
    taxFree: false,
    updatedAt: "2026-03-15T10:00:00.000Z",
    ...overrides,
  };
}

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
          taxFree: true,
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
