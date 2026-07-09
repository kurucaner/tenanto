import { memo, useMemo } from "react";

import { ReportDonutChart } from "@/components/reports/charts/report-donut-chart";
import {
  incomeCompositionToSegments,
  type IPropertyReportSalesTypeBreakdown,
  type IPropertyReportUnitSummary,
} from "@/packages/shared";

interface ReportIncomeCompositionChartProps {
  byUnit: IPropertyReportUnitSummary[];
  salesTypeBreakdown: IPropertyReportSalesTypeBreakdown;
}

export const ReportIncomeCompositionChart = memo(
  ({ byUnit, salesTypeBreakdown }: ReportIncomeCompositionChartProps) => {
    const segments = useMemo(
      () => incomeCompositionToSegments(byUnit, salesTypeBreakdown),
      [byUnit, salesTypeBreakdown]
    );

    return (
      <ReportDonutChart
        emptyMessage="No income recorded in this period."
        segments={segments}
        title="Income composition"
        totalLabel="Gross income"
      />
    );
  }
);
ReportIncomeCompositionChart.displayName = "ReportIncomeCompositionChart";
