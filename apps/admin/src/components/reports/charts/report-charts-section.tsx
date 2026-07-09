import { memo } from "react";

import { ReportChannelChart } from "@/components/reports/charts/report-channel-chart";
import { ReportExpenseBreakdownChart } from "@/components/reports/charts/report-expense-breakdown-chart";
import { ReportIncomeExpensesChart } from "@/components/reports/charts/report-income-expenses-chart";
import { ReportRentalTypeChart } from "@/components/reports/charts/report-rental-type-chart";
import { ReportSalesTypeChart } from "@/components/reports/charts/report-sales-type-chart";
import { ReportTaxChart } from "@/components/reports/charts/report-tax-chart";
import type { IPropertyReportSummary } from "@/packages/shared";

interface ReportChartsSectionProps {
  summary: IPropertyReportSummary;
}

export const ReportChartsSection = memo(({ summary }: ReportChartsSectionProps) => (
  <section aria-label="Report charts" className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <ReportRentalTypeChart byUnit={summary.byUnit} />
      <ReportChannelChart channelSummary={summary.channelSummary} />
      <ReportTaxChart taxSummary={summary.taxSummary} />
      <ReportSalesTypeChart salesTypeBreakdown={summary.salesTypeBreakdown} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <ReportIncomeExpensesChart byMonth={summary.byMonth} />
      <ReportExpenseBreakdownChart expenseByCategory={summary.expenseByCategory} />
    </div>
  </section>
));
ReportChartsSection.displayName = "ReportChartsSection";
