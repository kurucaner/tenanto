import { describe, expect, test } from "bun:test";

import {
  buildIncomeCompositionBreakdown,
  buildProfitTrendChartRows,
  buildReportChartSegments,
  calculateOperationalProfitMargin,
  incomeCompositionToSegments,
  type IPropertyReportUnitSummary,
  otherIncomeTypeToSegments,
  PROPERTY_AMENITY_UNIT_ID,
} from "./property-report-chart-utils";
import { UnitRentalType } from "./property-types";

function makeUnitRow(
  overrides: Partial<IPropertyReportUnitSummary> = {}
): IPropertyReportUnitSummary {
  return {
    adr: 0,
    availableNights: 31,
    bookedNights: 0,
    grossIncome: 0,
    netIncome: 0,
    occupancyRate: 0,
    rentalType: UnitRentalType.SHORT_TERM,
    stayGrossIncome: 0,
    unitId: "unit-1",
    unitNumber: "101",
    ...overrides,
  };
}

describe("buildIncomeCompositionBreakdown", () => {
  test("sums stay income by rental type and all other-income lines", () => {
    const breakdown = buildIncomeCompositionBreakdown(
      [
        makeUnitRow({
          grossIncome: 1200,
          rentalType: UnitRentalType.LONG_TERM,
          stayGrossIncome: 1000,
          unitId: "lt-1",
        }),
        makeUnitRow({
          grossIncome: 700,
          rentalType: UnitRentalType.SHORT_TERM,
          stayGrossIncome: 500,
          unitId: "st-1",
        }),
        makeUnitRow({
          grossIncome: 200,
          rentalType: null,
          stayGrossIncome: 0,
          unitId: PROPERTY_AMENITY_UNIT_ID,
          unitNumber: "Property Amenity",
        }),
      ],
      {
        cleaningFromStays: 0,
        otherIncomeByType: [
          { amount: 150, incomeLineTypeId: "type-amenity", name: "Pool" },
          { amount: 50, incomeLineTypeId: "type-unit", name: "Late fee" },
        ],
        room: 0,
      }
    );

    expect(breakdown).toEqual({
      longTerm: 1000,
      other: 200,
      shortTerm: 500,
    });
  });

  test("ignores property amenity row for long-term and short-term buckets", () => {
    const breakdown = buildIncomeCompositionBreakdown(
      [
        makeUnitRow({
          grossIncome: 200,
          rentalType: null,
          stayGrossIncome: 0,
          unitId: PROPERTY_AMENITY_UNIT_ID,
          unitNumber: "Property Amenity",
        }),
      ],
      {
        cleaningFromStays: 0,
        otherIncomeByType: [{ amount: 200, incomeLineTypeId: "type-pool", name: "Pool" }],
        room: 0,
      }
    );

    expect(breakdown).toEqual({
      longTerm: 0,
      other: 200,
      shortTerm: 0,
    });
  });
});

describe("buildReportChartSegments", () => {
  test("groups tiny slices into Other when there are more than five segments", () => {
    const segments = buildReportChartSegments([
      { id: "a", label: "A", value: 700 },
      { id: "b", label: "B", value: 200 },
      { id: "c", label: "C", value: 50 },
      { id: "d", label: "D", value: 20 },
      { id: "e", label: "E", value: 15 },
      { id: "f", label: "F", value: 10 },
      { id: "g", label: "G", value: 5 },
    ]);

    expect(segments.some((segment) => segment.id === "other")).toBe(true);
    expect(segments.reduce((sum, segment) => sum + segment.value, 0)).toBe(1000);
  });
});

describe("incomeCompositionToSegments", () => {
  test("excludes zero-value buckets", () => {
    const segments = incomeCompositionToSegments(
      [
        makeUnitRow({
          grossIncome: 800,
          rentalType: UnitRentalType.SHORT_TERM,
          stayGrossIncome: 800,
        }),
      ],
      { cleaningFromStays: 0, otherIncomeByType: [], room: 0 }
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]?.label).toBe("Short-term");
    expect(segments[0]?.share).toBe(1);
  });

  test("segments sum to total gross income across all buckets", () => {
    const segments = incomeCompositionToSegments(
      [
        makeUnitRow({
          grossIncome: 1000,
          rentalType: UnitRentalType.LONG_TERM,
          stayGrossIncome: 1000,
          unitId: "lt-1",
        }),
        makeUnitRow({
          grossIncome: 550,
          rentalType: UnitRentalType.SHORT_TERM,
          stayGrossIncome: 500,
          unitId: "st-1",
        }),
      ],
      {
        cleaningFromStays: 0,
        otherIncomeByType: [{ amount: 50, incomeLineTypeId: "type-fee", name: "Late fee" }],
        room: 0,
      }
    );

    expect(segments).toHaveLength(3);
    expect(segments.reduce((sum, segment) => sum + segment.value, 0)).toBe(1550);
  });
});

describe("otherIncomeTypeToSegments", () => {
  test("excludes room and cleaning fee from segments", () => {
    const segments = otherIncomeTypeToSegments({
      cleaningFromStays: 980,
      otherIncomeByType: [
        { amount: 3500, incomeLineTypeId: "type-beach", name: "Beach equipment rental" },
        { amount: 2015, incomeLineTypeId: "type-service", name: "Extra service" },
      ],
      room: 12766,
    });

    expect(segments).toHaveLength(2);
    expect(segments.some((segment) => segment.label === "Room")).toBe(false);
    expect(segments.some((segment) => segment.label === "Cleaning fee")).toBe(false);
    expect(segments.reduce((sum, segment) => sum + segment.value, 0)).toBe(5515);
  });

  test("returns empty segments when there is no other income", () => {
    const segments = otherIncomeTypeToSegments({
      cleaningFromStays: 500,
      otherIncomeByType: [],
      room: 10000,
    });

    expect(segments).toEqual([]);
  });
});

describe("calculateOperationalProfitMargin", () => {
  test("returns margin as a share of gross income", () => {
    expect(calculateOperationalProfitMargin(1000, 250)).toBe(0.25);
  });

  test("returns null when gross income is zero", () => {
    expect(calculateOperationalProfitMargin(0, 100)).toBeNull();
  });
});

describe("buildProfitTrendChartRows", () => {
  test("preserves month order and computes profit margin per row", () => {
    const rows = buildProfitTrendChartRows([
      {
        expenses: 200,
        grossIncome: 1000,
        month: "2026-01",
        netIncome: 800,
        operationalNet: 600,
      },
      {
        expenses: 0,
        grossIncome: 0,
        month: "2026-02",
        netIncome: 0,
        operationalNet: -50,
      },
    ]);

    expect(rows).toEqual([
      { month: "2026-01", operationalNet: 600, profitMargin: 0.6 },
      { month: "2026-02", operationalNet: -50, profitMargin: null },
    ]);
  });
});
