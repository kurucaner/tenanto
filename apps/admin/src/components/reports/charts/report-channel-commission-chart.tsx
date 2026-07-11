import { memo, useMemo } from "react";

import { ReportDonutChart } from "@/components/reports/charts/report-donut-chart";
import {
  channelCommissionSummaryToSegments,
  type IPropertyReportChannelSummary,
} from "@/packages/shared";

interface ReportChannelCommissionChartProps {
  channelSummary: IPropertyReportChannelSummary[];
}

export const ReportChannelCommissionChart = memo(
  ({ channelSummary }: ReportChannelCommissionChartProps) => {
    const segments = useMemo(
      () => channelCommissionSummaryToSegments(channelSummary),
      [channelSummary]
    );

    return (
      <ReportDonutChart
        emptyMessage="No channel commission recorded in this period."
        segments={segments}
        title="Commission by channel"
        totalLabel="Total commission"
      />
    );
  }
);
ReportChannelCommissionChart.displayName = "ReportChannelCommissionChart";
