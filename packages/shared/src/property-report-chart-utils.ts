import type {
  IPropertyReportChannelSummary,
  IPropertyReportExpenseCategory,
  IPropertyReportMonthSummary,
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

export interface IProfitTrendChartRow {
  month: string;
  operationalNet: number;
  profitMargin: number | null;
}

export interface IRevenueExpenseTrendChartRow {
  expenses: number;
  grossIncome: number;
  month: string;
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

export function calculateOperationalProfitMargin(
  grossIncome: number,
  operationalNet: number
): number | null {
  if (grossIncome <= 0) return null;
  return roundShare(operationalNet / grossIncome);
}

export function buildProfitTrendChartRows(
  byMonth: IPropertyReportMonthSummary[]
): IProfitTrendChartRow[] {
  return byMonth.map((row) => ({
    month: row.month,
    operationalNet: row.operationalNet,
    profitMargin: calculateOperationalProfitMargin(row.grossIncome, row.operationalNet),
  }));
}

export function buildRevenueExpenseTrendChartRows(
  byMonth: IPropertyReportMonthSummary[]
): IRevenueExpenseTrendChartRow[] {
  return byMonth.map((row) => ({
    expenses: row.expenses,
    grossIncome: row.grossIncome,
    month: row.month,
  }));
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
  channelSummary: IPropertyReportChannelSummary[]
): IReportChartSegment[] {
  return buildReportChartSegments(
    channelSummary.map((row) => ({
      id: row.channelCommissionId,
      label: row.name,
      value: row.grossIncome,
    }))
  );
}

export function channelCommissionSummaryToSegments(
  channelSummary: IPropertyReportChannelSummary[]
): IReportChartSegment[] {
  return buildReportChartSegments(
    channelSummary.map((row) => ({
      id: row.channelCommissionId,
      label: row.name,
      value: row.channelCommission,
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
  expenseByCategory: IPropertyReportExpenseCategory[]
): IReportChartSegment[] {
  return buildReportChartSegments(
    expenseByCategory.map((row) => ({
      id: row.categoryId,
      label: row.name,
      value: row.amount,
    }))
  );
}
