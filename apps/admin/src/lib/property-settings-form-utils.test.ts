import { describe, expect, test } from "bun:test";

import {
  type PropertyChannelCommissionFormRow,
  type PropertyExpenseCategoryTypeFormRow,
  type PropertyTaxRateFormRow,
} from "@/lib/property-settings-form-types";

import {
  channelCommissionsDiffer,
  expenseCategoryTypesDiffer,
  taxRatesDiffer,
} from "./property-settings-form-utils";

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

const savedChannelRows: PropertyChannelCommissionFormRow[] = [
  {
    clientId: "channel-1",
    excludeCleaningFromCommissionBase: false,
    excludeResortTaxFromPayout: true,
    id: "channel-1",
    name: "Airbnb",
    ratePercent: "15",
  },
  {
    clientId: "channel-2",
    excludeCleaningFromCommissionBase: true,
    excludeResortTaxFromPayout: false,
    id: "channel-2",
    name: "VRBO",
    ratePercent: "8",
  },
];

describe("channelCommissionsDiffer", () => {
  test("returns false when current matches saved", () => {
    expect(channelCommissionsDiffer(savedChannelRows, savedChannelRows)).toBe(false);
  });

  test("returns true for a new row without id", () => {
    const current: PropertyChannelCommissionFormRow[] = [
      ...savedChannelRows,
      {
        clientId: "new-row",
        excludeCleaningFromCommissionBase: false,
        excludeResortTaxFromPayout: false,
        name: "Booking.com",
        ratePercent: "12",
      },
    ];

    expect(channelCommissionsDiffer(current, savedChannelRows)).toBe(true);
  });

  test("returns true when name changes", () => {
    const current: PropertyChannelCommissionFormRow[] = [
      { ...savedChannelRows[0]!, name: "Airbnb updated" },
      savedChannelRows[1]!,
    ];

    expect(channelCommissionsDiffer(current, savedChannelRows)).toBe(true);
  });

  test("returns false when only trailing whitespace on name differs", () => {
    const current: PropertyChannelCommissionFormRow[] = [
      { ...savedChannelRows[0]!, name: "Airbnb  " },
      savedChannelRows[1]!,
    ];

    expect(channelCommissionsDiffer(current, savedChannelRows)).toBe(false);
  });

  test("returns true when ratePercent changes", () => {
    const current: PropertyChannelCommissionFormRow[] = [
      { ...savedChannelRows[0]!, ratePercent: "16" },
      savedChannelRows[1]!,
    ];

    expect(channelCommissionsDiffer(current, savedChannelRows)).toBe(true);
  });

  test("returns false when rate is numerically equivalent", () => {
    const current: PropertyChannelCommissionFormRow[] = [
      { ...savedChannelRows[0]!, ratePercent: "15.00" },
      savedChannelRows[1]!,
    ];

    expect(channelCommissionsDiffer(current, savedChannelRows)).toBe(false);
  });

  test("returns true when excludeCleaningFromCommissionBase toggles", () => {
    const current: PropertyChannelCommissionFormRow[] = [
      { ...savedChannelRows[0]!, excludeCleaningFromCommissionBase: true },
      savedChannelRows[1]!,
    ];

    expect(channelCommissionsDiffer(current, savedChannelRows)).toBe(true);
  });

  test("returns true when excludeResortTaxFromPayout toggles", () => {
    const current: PropertyChannelCommissionFormRow[] = [
      { ...savedChannelRows[0]!, excludeResortTaxFromPayout: false },
      savedChannelRows[1]!,
    ];

    expect(channelCommissionsDiffer(current, savedChannelRows)).toBe(true);
  });

  test("returns true when a saved row is removed", () => {
    const current: PropertyChannelCommissionFormRow[] = [savedChannelRows[0]!];

    expect(channelCommissionsDiffer(current, savedChannelRows)).toBe(true);
  });
});
