import type {
  IPropertyReportExpenseCategory,
  IPropertyReportMonthSummary,
  IPropertyReportTotals,
} from "./property-report-types";

export interface IHomeFinancialOverview {
  byMonth: IPropertyReportMonthSummary[];
  expenseByCategory: IPropertyReportExpenseCategory[];
  period: { from: string; to: string };
  propertyCount: number;
  totals: IPropertyReportTotals;
}
