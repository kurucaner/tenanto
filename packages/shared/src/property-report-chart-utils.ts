import type {
  IPropertyReportChannelSummary,
  IPropertyReportExpenseCategory,
  IPropertyReportSalesTypeBreakdown,
  IPropertyReportTaxSummaryItem,
  IPropertyReportUnitSummary,
} from "./property-report-types";
import { UnitRentalType } from "./property-types";

export const PROPERTY_AMENITY_UNIT_ID = "property-amenity";

export interface IIncomeCompositionBreakdown {
  longTerm: number;
  other: number;
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

function sumOtherIncomeAmounts(breakdown: IPropertyReportSalesTypeBreakdown): number {
  return breakdown.otherIncomeByType.reduce((sum, row) => sum + row.amount, 0);
}

export function buildIncomeCompositionBreakdown(
  byUnit: IPropertyReportUnitSummary[],
  salesTypeBreakdown: IPropertyReportSalesTypeBreakdown
): IIncomeCompositionBreakdown {
  let longTerm = 0;
  let shortTerm = 0;

  for (const unit of byUnit) {
    if (unit.unitId === PROPERTY_AMENITY_UNIT_ID) continue;
    if (unit.rentalType === UnitRentalType.LONG_TERM) {
      longTerm += unit.stayGrossIncome;
      continue;
    }
    if (unit.rentalType === UnitRentalType.SHORT_TERM) {
      shortTerm += unit.stayGrossIncome;
    }
  }

  return { longTerm, other: sumOtherIncomeAmounts(salesTypeBreakdown), shortTerm };
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

export function incomeCompositionToSegments(
  byUnit: IPropertyReportUnitSummary[],
  salesTypeBreakdown: IPropertyReportSalesTypeBreakdown
): IReportChartSegment[] {
  const breakdown = buildIncomeCompositionBreakdown(byUnit, salesTypeBreakdown);
  return buildReportChartSegments([
    { id: "long_term", label: "Long-term", value: breakdown.longTerm },
    { id: "short_term", label: "Short-term", value: breakdown.shortTerm },
    { id: "other", label: "Other", value: breakdown.other },
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

export function otherIncomeTypeToSegments(
  breakdown: IPropertyReportSalesTypeBreakdown
): IReportChartSegment[] {
  return buildReportChartSegments(
    breakdown.otherIncomeByType.map((row) => ({
      id: row.incomeLineTypeId,
      label: row.name,
      value: row.amount,
    }))
  );
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
