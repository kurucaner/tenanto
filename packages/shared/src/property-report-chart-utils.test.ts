import { describe, expect, test } from "bun:test";

import {
  buildReportChartSegments,
  buildRentalTypeIncomeBreakdown,
  PROPERTY_AMENITY_UNIT_ID,
  rentalTypeToSegments,
  type IPropertyReportUnitSummary,
} from "./property-report-chart-utils";
import { UnitRentalType } from "./property-types";

function makeUnitRow(overrides: Partial<IPropertyReportUnitSummary> = {}): IPropertyReportUnitSummary {
  return {
    adr: 0,
    availableNights: 31,
    bookedNights: 0,
    grossIncome: 0,
    netIncome: 0,
    occupancyRate: 0,
    rentalType: UnitRentalType.SHORT_TERM,
    unitId: "unit-1",
    unitNumber: "101",
    ...overrides,
  };
}

describe("buildRentalTypeIncomeBreakdown", () => {
  test("sums gross income by rental type and amenity bucket", () => {
    const breakdown = buildRentalTypeIncomeBreakdown([
      makeUnitRow({ grossIncome: 1000, rentalType: UnitRentalType.LONG_TERM, unitId: "lt-1" }),
      makeUnitRow({ grossIncome: 500, rentalType: UnitRentalType.SHORT_TERM, unitId: "st-1" }),
      makeUnitRow({
        grossIncome: 200,
        rentalType: null,
        unitId: PROPERTY_AMENITY_UNIT_ID,
        unitNumber: "Property Amenity",
      }),
    ]);

    expect(breakdown).toEqual({
      longTerm: 1000,
      propertyAmenity: 200,
      shortTerm: 500,
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

describe("rentalTypeToSegments", () => {
  test("excludes zero-value rental types", () => {
    const segments = rentalTypeToSegments([
      makeUnitRow({ grossIncome: 800, rentalType: UnitRentalType.SHORT_TERM }),
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.label).toBe("Short-term");
    expect(segments[0]?.share).toBe(1);
  });
});
