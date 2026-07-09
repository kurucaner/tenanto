import { memo } from "react";

import { ReportChannelChart } from "@/components/reports/charts/report-channel-chart";
import { ReportExpenseBreakdownChart } from "@/components/reports/charts/report-expense-breakdown-chart";
import { ReportIncomeCompositionChart } from "@/components/reports/charts/report-income-composition-chart";
import { ReportOtherIncomeTypesChart } from "@/components/reports/charts/report-other-income-types-chart";
import { ReportProfitTrendChart } from "@/components/reports/charts/report-profit-trend-chart";
import { ReportTaxChart } from "@/components/reports/charts/report-tax-chart";
import type { IPropertyReportSummary } from "@/packages/shared";

interface ReportChartsSectionProps {
  summary: IPropertyReportSummary;
}

export const ReportChartsSection = memo(({ summary }: ReportChartsSectionProps) => (
  <section aria-label="Report charts" className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <ReportIncomeCompositionChart
        byUnit={summary.byUnit}
        salesTypeBreakdown={summary.salesTypeBreakdown}
      />
      <ReportChannelChart channelSummary={summary.channelSummary} />
      <ReportOtherIncomeTypesChart salesTypeBreakdown={summary.salesTypeBreakdown} />
      <ReportTaxChart taxSummary={summary.taxSummary} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <ReportProfitTrendChart byMonth={summary.byMonth} />
      <ReportExpenseBreakdownChart expenseByCategory={summary.expenseByCategory} />
    </div>
  </section>
));
ReportChartsSection.displayName = "ReportChartsSection";
