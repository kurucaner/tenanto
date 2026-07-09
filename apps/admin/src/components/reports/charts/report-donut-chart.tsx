import { memo, useMemo } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format-money";
import { formatReportPercent } from "@/lib/report-date-defaults";
import type { IReportChartSegment } from "@/packages/shared";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ReportDonutChartProps {
  description?: string;
  emptyMessage?: string;
  segments: IReportChartSegment[];
  title: string;
  totalLabel?: string;
}

export const ReportDonutChart = memo(
  ({
    description,
    emptyMessage = "No data in this period.",
    segments,
    title,
    totalLabel = "Total",
  }: ReportDonutChartProps) => {
    const total = useMemo(() => segments.reduce((sum, segment) => sum + segment.value, 0), [segments]);

    const chartConfig = useMemo(() => {
      const config: ChartConfig = {};
      for (const [index, segment] of segments.entries()) {
        config[segment.id] = {
          color: CHART_COLORS[index % CHART_COLORS.length],
          label: segment.label,
        };
      }
      return config;
    }, [segments]);

    const chartData = useMemo(
      () =>
        segments.map((segment, index) => ({
          fill: CHART_COLORS[index % CHART_COLORS.length],
          id: segment.id,
          label: segment.label,
          share: segment.share,
          value: segment.value,
        })),
      [segments]
    );

    if (segments.length === 0) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <ChartContainer
            className="mx-auto aspect-square h-[220px] max-h-[220px] w-full"
            config={chartConfig}
          >
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const share =
                        typeof item.payload === "object" &&
                        item.payload !== null &&
                        "share" in item.payload
                          ? Number(item.payload.share)
                          : 0;
                      return (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono font-medium tabular-nums">
                            {formatMoney(Number(value))} · {formatReportPercent(share)}
                          </span>
                        </div>
                      );
                    }}
                    hideLabel
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={60}
                nameKey="label"
                outerRadius={90}
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.id} fill={entry.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                    const { cx, cy } = viewBox;
                    return (
                      <text dominantBaseline="middle" textAnchor="middle" x={cx} y={cy}>
                        <tspan className="fill-muted-foreground text-xs" x={cx} y={cy - 8}>
                          {totalLabel}
                        </tspan>
                        <tspan
                          className="fill-foreground text-sm font-semibold"
                          x={cx}
                          y={cy + 12}
                        >
                          {formatMoney(total)}
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="space-y-2">
            {segments.map((segment, index) => (
              <li key={segment.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="truncate">{segment.label}</span>
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatMoney(segment.value)} · {formatReportPercent(segment.share)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }
);
ReportDonutChart.displayName = "ReportDonutChart";
