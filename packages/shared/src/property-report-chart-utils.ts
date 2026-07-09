import type {
  IPropertyReportChannelSummary,
  IPropertyReportExpenseCategory,
  IPropertyReportSalesTypeBreakdown,
  IPropertyReportTaxSummaryItem,
  IPropertyReportUnitSummary,
} from "./property-report-types";
import { UnitRentalType } from "./property-types";

export const PROPERTY_AMENITY_UNIT_ID = "property-amenity";

export interface IRentalTypeIncomeBreakdown {
  longTerm: number;
  propertyAmenity: number;
  shortTerm: number;
}

export interface IReportChartSegment {
  id: string;
  label: string;
  share: number;
  value: number;
}

export interface IBuildReportChartSegmentsOptions {
  groupBelowShare?: number;
  otherLabel?: string;
}

function roundShare(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function buildRentalTypeIncomeBreakdown(
  byUnit: IPropertyReportUnitSummary[]
): IRentalTypeIncomeBreakdown {
  let longTerm = 0;
  let shortTerm = 0;
  let propertyAmenity = 0;

  for (const unit of byUnit) {
    if (unit.unitId === PROPERTY_AMENITY_UNIT_ID) {
      propertyAmenity += unit.grossIncome;
      continue;
    }
    if (unit.rentalType === UnitRentalType.LONG_TERM) {
      longTerm += unit.grossIncome;
      continue;
    }
    if (unit.rentalType === UnitRentalType.SHORT_TERM) {
      shortTerm += unit.grossIncome;
    }
  }

  return { longTerm, propertyAmenity, shortTerm };
}

export function buildReportChartSegments(
  items: Array<{ id: string; label: string; value: number }>,
  options: IBuildReportChartSegmentsOptions = {}
): IReportChartSegment[] {
  const { groupBelowShare = 0.03, otherLabel = "Other" } = options;
  const positiveItems = items?.filter((item) => item.value > 0);
  const total = positiveItems?.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) return [];

  const rawSegments: IReportChartSegment[] = positiveItems.map((item) => ({
    id: item.id,
    label: item.label,
    share: roundShare(item.value / total),
    value: item.value,
  }));

  if (rawSegments?.length <= 5) return rawSegments;

  const keep: IReportChartSegment[] = [];
  let otherValue = 0;

  for (const segment of rawSegments) {
    if (segment.share >= groupBelowShare) {
      keep.push(segment);
      continue;
    }
    otherValue += segment.value;
  }

  if (otherValue > 0) {
    keep.push({
      id: "other",
      label: otherLabel,
      share: roundShare(otherValue / total),
      value: otherValue,
    });
  }

  return keep.sort((a, b) => b.value - a.value);
}

export function rentalTypeToSegments(byUnit: IPropertyReportUnitSummary[]): IReportChartSegment[] {
  const breakdown = buildRentalTypeIncomeBreakdown(byUnit);
  return buildReportChartSegments([
    { id: "long_term", label: "Long-term", value: breakdown.longTerm },
    { id: "short_term", label: "Short-term", value: breakdown.shortTerm },
    {
      id: PROPERTY_AMENITY_UNIT_ID,
      label: "Property amenities",
      value: breakdown.propertyAmenity,
    },
  ]);
}

export function channelSummaryToSegments(
  channelSummary: IPropertyReportChannelSummary[],
  formatChannelLabel: (channel: IPropertyReportChannelSummary["channel"]) => string
): IReportChartSegment[] {
  return buildReportChartSegments(
    channelSummary.map((row) => ({
      id: row.channel,
      label: formatChannelLabel(row.channel),
      value: row.grossIncome,
    }))
  );
}

export function salesTypeToSegments(
  breakdown: IPropertyReportSalesTypeBreakdown
): IReportChartSegment[] {
  const items = [
    { id: "room", label: "Room", value: breakdown.room },
    { id: "cleaningFromStays", label: "Cleaning fee", value: breakdown.cleaningFromStays },
    ...breakdown.otherIncomeByType.map((row) => ({
      id: row.incomeLineTypeId,
      label: row.name,
      value: row.amount,
    })),
  ];
  return buildReportChartSegments(items);
}

export function taxSummaryToSegments(
  taxSummary: IPropertyReportTaxSummaryItem[]
): IReportChartSegment[] {
  return buildReportChartSegments(
    taxSummary.map((row) => ({
      id: row.taxRateId,
      label: row.name,
      value: row.amount,
    }))
  );
}

export function expenseCategoryToSegments(
  expenseByCategory: IPropertyReportExpenseCategory[],
  formatCategoryLabel: (category: IPropertyReportExpenseCategory["category"]) => string
): IReportChartSegment[] {
  return buildReportChartSegments(
    expenseByCategory.map((row) => ({
      id: row.category,
      label: formatCategoryLabel(row.category),
      value: row.amount,
    }))
  );
}
