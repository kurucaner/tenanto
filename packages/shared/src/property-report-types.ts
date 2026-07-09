import type { TExpenseCategory } from "./property-expense-types";
import type { TReservationChannel } from "./property-reservation-types";
import type { TUnitRentalType } from "./property-types";

export const ReportRentalTypeFilter = {
  BOTH: "both",
  LONG_TERM: "long_term",
  SHORT_TERM: "short_term",
} as const;

export type TReportRentalTypeFilter =
  (typeof ReportRentalTypeFilter)[keyof typeof ReportRentalTypeFilter];

export interface IPropertyReportsQuery {
  channel?: TReservationChannel;
  from: string;
  rentalType?: TReportRentalTypeFilter;
  to: string;
  unitId?: string;
}

export interface IPropertyReportTotals {
  grossIncome: number;
  netIncome: number;
  operationalNet: number;
  totalExpenses: number;
}

export interface IPropertyReportOtherIncomeByType {
  amount: number;
  incomeLineTypeId: string;
  name: string;
}

export interface IPropertyReportSalesTypeBreakdown {
  cleaningFromStays: number;
  otherIncomeByType: IPropertyReportOtherIncomeByType[];
  room: number;
}

export interface IPropertyReportChannelSummary {
  channel: TReservationChannel;
  channelCommission: number;
  grossIncome: number;
  stayCount: number;
}

export interface IPropertyReportUnitSummary {
  adr: number;
  availableNights: number;
  bookedNights: number;
  grossIncome: number;
  netIncome: number;
  occupancyRate: number;
  // null for the synthetic "Property Amenity" row (income not tied to a rentable unit).
  rentalType: TUnitRentalType | null;
  unitId: string;
  unitNumber: string;
}

export interface IPropertyReportMonthSummary {
  expenses: number;
  grossIncome: number;
  month: string;
  netIncome: number;
  operationalNet: number;
}

export interface IPropertyReportExpenseCategory {
  amount: number;
  category: TExpenseCategory;
}

export interface IPropertyReportTaxSummaryItem {
  amount: number;
  name: string;
  taxRateId: string;
}

export interface IPropertyReportSummary {
  byMonth: IPropertyReportMonthSummary[];
  byUnit: IPropertyReportUnitSummary[];
  channelSummary: IPropertyReportChannelSummary[];
  expenseByCategory: IPropertyReportExpenseCategory[];
  filters: IPropertyReportsQuery;
  period: { from: string; to: string };
  propertyExpensesTotal: number;
  salesTypeBreakdown: IPropertyReportSalesTypeBreakdown;
  taxSummary: IPropertyReportTaxSummaryItem[];
  totals: IPropertyReportTotals;
}

export interface IPortfolioPropertyReportRow {
  propertyId: string;
  propertyName: string;
  summary: IPropertyReportSummary;
}

export interface IPortfolioReportSummary {
  from: string;
  properties: IPortfolioPropertyReportRow[];
  rentalType?: TReportRentalTypeFilter;
  to: string;
  totals: IPropertyReportSummary;
}
