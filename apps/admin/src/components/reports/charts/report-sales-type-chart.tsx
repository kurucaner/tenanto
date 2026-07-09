import { memo, useMemo } from "react";

import { ReportDonutChart } from "@/components/reports/charts/report-donut-chart";
import { type IPropertyReportSalesTypeBreakdown, salesTypeToSegments } from "@/packages/shared";

interface ReportSalesTypeChartProps {
  salesTypeBreakdown: IPropertyReportSalesTypeBreakdown;
}

export const ReportSalesTypeChart = memo(({ salesTypeBreakdown }: ReportSalesTypeChartProps) => {
  const segments = useMemo(() => salesTypeToSegments(salesTypeBreakdown), [salesTypeBreakdown]);

  return (
    <ReportDonutChart
      emptyMessage="No income recorded in this period."
      segments={segments}
      title="Income by sales type"
      totalLabel="Gross income"
    />
  );
});
ReportSalesTypeChart.displayName = "ReportSalesTypeChart";
