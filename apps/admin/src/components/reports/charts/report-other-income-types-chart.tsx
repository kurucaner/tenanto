import { memo, useMemo } from "react";

import { ReportDonutChart } from "@/components/reports/charts/report-donut-chart";
import {
  type IPropertyReportSalesTypeBreakdown,
  otherIncomeTypeToSegments,
} from "@/packages/shared";

interface ReportOtherIncomeTypesChartProps {
  salesTypeBreakdown: IPropertyReportSalesTypeBreakdown;
}

export const ReportOtherIncomeTypesChart = memo(
  ({ salesTypeBreakdown }: ReportOtherIncomeTypesChartProps) => {
    const segments = useMemo(
      () => otherIncomeTypeToSegments(salesTypeBreakdown),
      [salesTypeBreakdown]
    );

    return (
      <ReportDonutChart
        emptyMessage="No other income recorded in this period."
        segments={segments}
        title="Other income types"
        totalLabel="Other income"
      />
    );
  }
);
ReportOtherIncomeTypesChart.displayName = "ReportOtherIncomeTypesChart";
