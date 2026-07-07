import { formatChannelLabel } from "@/components/income/reservation-form-options";
import { formatExpenseCategoryLabel } from "@/components/expenses/expense-form-options";
import {
  compareDates,
  compareNumbers,
  compareStrings,
  type ISortState,
  sortRows,
} from "@/lib/table-sort";
import type {
  IPropertyReportChannelSummary,
  IPropertyReportExpenseCategory,
  IPropertyReportMonthSummary,
  IPropertyReportUnitSummary,
  IPortfolioPropertyReportRow,
} from "@/packages/shared";

export interface ISalesTypeBreakdownRow {
  amount: number;
  id: string;
  label: string;
}

export function buildSalesTypeBreakdownRows(breakdown: {
  beachRental: number;
  extraCleaning: number;
  extraService: number;
  room: number;
  totalCleaning: number;
}): ISalesTypeBreakdownRow[] {
  return [
    { amount: breakdown.room, id: "room", label: "Room" },
    { amount: breakdown.totalCleaning, id: "totalCleaning", label: "Cleaning (total)" },
    { amount: breakdown.extraCleaning, id: "extraCleaning", label: "Extra cleaning" },
    { amount: breakdown.extraService, id: "extraService", label: "Extra service" },
    { amount: breakdown.beachRental, id: "beachRental", label: "Beach rental" },
  ];
}

function sortByStringField<T>(rows: T[], sortState: ISortState, getValue: (row: T) => string) {
  return sortRows(rows, sortState, (a, b) => compareStrings(getValue(a), getValue(b)));
}

function sortByNumberField<T>(rows: T[], sortState: ISortState, getValue: (row: T) => number) {
  return sortRows(rows, sortState, (a, b) => compareNumbers(getValue(a), getValue(b)));
}

export function sortSalesTypeRows(rows: ISalesTypeBreakdownRow[], sortState: ISortState) {
  if (sortState.columnId === "amount") {
    return sortByNumberField(rows, sortState, (row) => row.amount);
  }
  return sortByStringField(rows, sortState, (row) => row.label);
}

export function sortChannelSummaryRows(
  rows: IPropertyReportChannelSummary[],
  sortState: ISortState
) {
  switch (sortState.columnId) {
    case "gross":
      return sortByNumberField(rows, sortState, (row) => row.grossIncome);
    case "commission":
      return sortByNumberField(rows, sortState, (row) => row.channelCommission);
    case "stays":
      return sortByNumberField(rows, sortState, (row) => row.stayCount);
    default:
      return sortByStringField(rows, sortState, (row) => formatChannelLabel(row.channel));
  }
}

export function sortUnitSummaryRows(rows: IPropertyReportUnitSummary[], sortState: ISortState) {
  switch (sortState.columnId) {
    case "gross":
      return sortByNumberField(rows, sortState, (row) => row.grossIncome);
    case "net":
      return sortByNumberField(rows, sortState, (row) => row.netIncome);
    case "bookedNights":
      return sortByNumberField(rows, sortState, (row) => row.bookedNights);
    case "availableNights":
      return sortByNumberField(rows, sortState, (row) => row.availableNights);
    case "occupancy":
      return sortByNumberField(rows, sortState, (row) => row.occupancyRate);
    case "adr":
      return sortByNumberField(rows, sortState, (row) => row.adr);
    default:
      return sortByStringField(rows, sortState, (row) => row.unitNumber);
  }
}

export function sortMonthSummaryRows(rows: IPropertyReportMonthSummary[], sortState: ISortState) {
  switch (sortState.columnId) {
    case "gross":
      return sortByNumberField(rows, sortState, (row) => row.grossIncome);
    case "net":
      return sortByNumberField(rows, sortState, (row) => row.netIncome);
    case "expenses":
      return sortByNumberField(rows, sortState, (row) => row.expenses);
    case "operationalNet":
      return sortByNumberField(rows, sortState, (row) => row.operationalNet);
    default:
      return sortRows(rows, sortState, (a, b) => compareDates(a.month, b.month));
  }
}

export function sortExpenseCategoryRows(
  rows: IPropertyReportExpenseCategory[],
  sortState: ISortState
) {
  if (sortState.columnId === "amount") {
    return sortByNumberField(rows, sortState, (row) => row.amount);
  }
  return sortByStringField(rows, sortState, (row) => formatExpenseCategoryLabel(row.category));
}

function aggregateOccupancy(row: IPortfolioPropertyReportRow): number {
  const { byUnit } = row.summary;
  if (byUnit.length === 0) return 0;
  const bookedNights = byUnit.reduce((sum, unit) => sum + unit.bookedNights, 0);
  const availableNights = byUnit.reduce((sum, unit) => sum + unit.availableNights, 0);
  return availableNights > 0 ? bookedNights / availableNights : 0;
}

function aggregateAdr(row: IPortfolioPropertyReportRow): number {
  const { byUnit } = row.summary;
  if (byUnit.length === 0) return 0;
  const totalRevenue = byUnit.reduce((sum, unit) => sum + unit.adr * unit.bookedNights, 0);
  const bookedNights = byUnit.reduce((sum, unit) => sum + unit.bookedNights, 0);
  return bookedNights > 0 ? totalRevenue / bookedNights : 0;
}

export function sortPortfolioPropertyRows(
  rows: IPortfolioPropertyReportRow[],
  sortState: ISortState
) {
  switch (sortState.columnId) {
    case "netIncome":
      return sortByNumberField(rows, sortState, (row) => row.summary.totals.netIncome);
    case "expenses":
      return sortByNumberField(rows, sortState, (row) => row.summary.totals.totalExpenses);
    case "operationalNet":
      return sortByNumberField(rows, sortState, (row) => row.summary.totals.operationalNet);
    case "occupancy":
      return sortByNumberField(rows, sortState, (row) => aggregateOccupancy(row));
    case "adr":
      return sortByNumberField(rows, sortState, (row) => aggregateAdr(row));
    default:
      return sortByStringField(rows, sortState, (row) => row.propertyName);
  }
}
