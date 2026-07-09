import { memo, useMemo } from "react";

import { ReportDonutChart } from "@/components/reports/charts/report-donut-chart";
import { type IPropertyReportUnitSummary, rentalTypeToSegments } from "@/packages/shared";

interface ReportRentalTypeChartProps {
  byUnit: IPropertyReportUnitSummary[];
}

export const ReportRentalTypeChart = memo(({ byUnit }: ReportRentalTypeChartProps) => {
  const segments = useMemo(() => rentalTypeToSegments(byUnit), [byUnit]);

  return (
    <ReportDonutChart
      emptyMessage="No income recorded for units or amenities in this period."
      segments={segments}
      title="Income by rental type"
      totalLabel="Gross income"
    />
  );
});
ReportRentalTypeChart.displayName = "ReportRentalTypeChart";
