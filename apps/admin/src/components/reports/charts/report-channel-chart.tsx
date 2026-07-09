import { memo, useMemo } from "react";

import { formatChannelLabel } from "@/components/income/reservation-form-options";
import { ReportDonutChart } from "@/components/reports/charts/report-donut-chart";
import {
  channelSummaryToSegments,
  type IPropertyReportChannelSummary,
} from "@/packages/shared";

interface ReportChannelChartProps {
  channelSummary: IPropertyReportChannelSummary[];
}

export const ReportChannelChart = memo(({ channelSummary }: ReportChannelChartProps) => {
  const segments = useMemo(
    () => channelSummaryToSegments(channelSummary, formatChannelLabel),
    [channelSummary]
  );

  return (
    <ReportDonutChart
      emptyMessage="No stay revenue recorded in this period."
      segments={segments}
      title="Stay revenue by channel"
      totalLabel="Stay gross"
    />
  );
});
ReportChannelChart.displayName = "ReportChannelChart";
