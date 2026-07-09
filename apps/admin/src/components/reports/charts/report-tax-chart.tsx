import { memo, useMemo } from "react";

import { ReportDonutChart } from "@/components/reports/charts/report-donut-chart";
import { type IPropertyReportTaxSummaryItem, taxSummaryToSegments } from "@/packages/shared";

interface ReportTaxChartProps {
  taxSummary: IPropertyReportTaxSummaryItem[];
}

export const ReportTaxChart = memo(({ taxSummary }: ReportTaxChartProps) => {
  const segments = useMemo(() => taxSummaryToSegments(taxSummary), [taxSummary]);

  return (
    <ReportDonutChart
      emptyMessage="No taxes recorded on stays in this period."
      segments={segments}
      title="Taxes collected by type"
      totalLabel="Total taxes"
    />
  );
});
ReportTaxChart.displayName = "ReportTaxChart";
