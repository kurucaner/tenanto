import { describe, expect, test } from "bun:test";

import { type PropertyExpenseCategoryTypeFormRow } from "@/components/settings/property-expense-category-types-editor";
import { type PropertyTaxRateFormRow } from "@/components/settings/property-tax-rates-editor";

import { expenseCategoryTypesDiffer, taxRatesDiffer } from "./property-settings-form-utils";

const savedRows: PropertyExpenseCategoryTypeFormRow[] = [
  {
    clientId: "cat-1",
    id: "cat-1",
    isAnnualAmount: false,
    name: "Utilities",
  },
  {
    clientId: "cat-2",
    id: "cat-2",
    isAnnualAmount: true,
    name: "Insurance",
  },
];

describe("expenseCategoryTypesDiffer", () => {
  test("returns false when current matches saved", () => {
    expect(expenseCategoryTypesDiffer(savedRows, savedRows)).toBe(false);
  });

  test("returns true for a new row without id", () => {
    const current: PropertyExpenseCategoryTypeFormRow[] = [
      ...savedRows,
      { clientId: "new-row", isAnnualAmount: false, name: "Maintenance" },
    ];

    expect(expenseCategoryTypesDiffer(current, savedRows)).toBe(true);
  });

  test("returns true when isAnnualAmount toggles on an existing row", () => {
    const current: PropertyExpenseCategoryTypeFormRow[] = [
      { ...savedRows[0]!, isAnnualAmount: true },
      savedRows[1]!,
    ];

    expect(expenseCategoryTypesDiffer(current, savedRows)).toBe(true);
  });

  test("returns true when name changes", () => {
    const current: PropertyExpenseCategoryTypeFormRow[] = [
      { ...savedRows[0]!, name: "Updated utilities" },
      savedRows[1]!,
    ];

    expect(expenseCategoryTypesDiffer(current, savedRows)).toBe(true);
  });

  test("returns false when only trailing whitespace differs", () => {
    const current: PropertyExpenseCategoryTypeFormRow[] = [
      { ...savedRows[0]!, name: "Utilities  " },
      savedRows[1]!,
    ];

    expect(expenseCategoryTypesDiffer(current, savedRows)).toBe(false);
  });

  test("returns true when a saved row is removed", () => {
    const current: PropertyExpenseCategoryTypeFormRow[] = [savedRows[0]!];

    expect(expenseCategoryTypesDiffer(current, savedRows)).toBe(true);
  });
});

const savedTaxRows: PropertyTaxRateFormRow[] = [
  {
    clientId: "tax-1",
    id: "tax-1",
    name: "State tax",
    ratePercent: "3.5",
  },
  {
    clientId: "tax-2",
    id: "tax-2",
    name: "Local tax",
    ratePercent: "1",
  },
];

describe("taxRatesDiffer", () => {
  test("returns false when current matches saved", () => {
    expect(taxRatesDiffer(savedTaxRows, savedTaxRows)).toBe(false);
  });

  test("returns true for a new row without id", () => {
    const current: PropertyTaxRateFormRow[] = [
      ...savedTaxRows,
      { clientId: "new-row", name: "Tourism tax", ratePercent: "2" },
    ];

    expect(taxRatesDiffer(current, savedTaxRows)).toBe(true);
  });

  test("returns true when name changes", () => {
    const current: PropertyTaxRateFormRow[] = [
      { ...savedTaxRows[0]!, name: "Updated state tax" },
      savedTaxRows[1]!,
    ];

    expect(taxRatesDiffer(current, savedTaxRows)).toBe(true);
  });

  test("returns false when only trailing whitespace on name differs", () => {
    const current: PropertyTaxRateFormRow[] = [
      { ...savedTaxRows[0]!, name: "State tax  " },
      savedTaxRows[1]!,
    ];

    expect(taxRatesDiffer(current, savedTaxRows)).toBe(false);
  });

  test("returns true when ratePercent changes", () => {
    const current: PropertyTaxRateFormRow[] = [
      { ...savedTaxRows[0]!, ratePercent: "4" },
      savedTaxRows[1]!,
    ];

    expect(taxRatesDiffer(current, savedTaxRows)).toBe(true);
  });

  test("returns false when rate is numerically equivalent", () => {
    const current: PropertyTaxRateFormRow[] = [
      { ...savedTaxRows[0]!, ratePercent: "3.50" },
      savedTaxRows[1]!,
    ];

    expect(taxRatesDiffer(current, savedTaxRows)).toBe(false);
  });

  test("returns true when a saved row is removed", () => {
    const current: PropertyTaxRateFormRow[] = [savedTaxRows[0]!];

    expect(taxRatesDiffer(current, savedTaxRows)).toBe(true);
  });
});
