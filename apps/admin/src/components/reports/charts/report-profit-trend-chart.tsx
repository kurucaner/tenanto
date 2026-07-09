import { memo, useId, useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format-money";
import { formatReportMonthLabel, formatReportPercent } from "@/lib/report-date-defaults";
import { buildProfitTrendChartRows, type IPropertyReportMonthSummary } from "@/packages/shared";

const chartConfig = {
  operationalNet: {
    color: "var(--chart-1)",
    label: "Operational net",
  },
  profitMargin: {
    color: "var(--chart-3)",
    label: "Profit margin",
  },
} satisfies ChartConfig;

interface ProfitTrendChartDatum {
  month: string;
  monthLabel: string;
  operationalNet: number;
  profitMargin: number | null;
}

function formatChartMoneyAxis(value: number): string {
  if (value >= 1000 || value <= -1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return `$${value}`;
}

function buildProfitTrendInsight(data: ProfitTrendChartDatum[]): string | null {
  if (data.length < 2) return null;

  let best = data[0]!;
  let worst = data[0]!;

  for (const row of data) {
    if (row.operationalNet > best.operationalNet) best = row;
    if (row.operationalNet < worst.operationalNet) worst = row;
  }

  return `Best: ${best.monthLabel} · ${formatMoney(best.operationalNet)} · Worst: ${worst.monthLabel} · ${formatMoney(worst.operationalNet)}`;
}

interface ReportProfitTrendChartProps {
  byMonth: IPropertyReportMonthSummary[];
}

export const ReportProfitTrendChart = memo(({ byMonth }: ReportProfitTrendChartProps) => {
  const gradientId = useId().replaceAll(":", "");

  const chartData = useMemo(
    (): ProfitTrendChartDatum[] =>
      buildProfitTrendChartRows(byMonth).map((row) => ({
        month: row.month,
        monthLabel: formatReportMonthLabel(row.month),
        operationalNet: row.operationalNet,
        profitMargin: row.profitMargin,
      })),
    [byMonth]
  );

  const insight = useMemo(() => buildProfitTrendInsight(chartData), [chartData]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Profit trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No monthly data in this period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Profit trend</CardTitle>
        {insight ? <CardDescription>{insight}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video h-[280px] w-full" config={chartConfig}>
          <ComposedChart accessibilityLayer data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-operationalNet)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-operationalNet)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="monthLabel" tickLine={false} tickMargin={8} />
            <YAxis
              axisLine={false}
              tickFormatter={formatChartMoneyAxis}
              tickLine={false}
              tickMargin={8}
              width={48}
              yAxisId="left"
            />
            <YAxis
              axisLine={false}
              orientation="right"
              tickFormatter={(value: number) => formatReportPercent(value)}
              tickLine={false}
              tickMargin={8}
              width={40}
              yAxisId="right"
            />
            <ReferenceLine stroke="var(--border)" y={0} yAxisId="left" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    if (item?.dataKey === "profitMargin") {
                      return value === null || value === undefined
                        ? "—"
                        : formatReportPercent(Number(value));
                    }
                    return formatMoney(Number(value));
                  }}
                  indicator="dot"
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="operationalNet"
              fill={`url(#${gradientId})`}
              stroke="var(--color-operationalNet)"
              type="monotone"
              yAxisId="left"
            />
            <Line
              connectNulls={false}
              dataKey="profitMargin"
              dot={{ fill: "var(--color-profitMargin)", r: 3 }}
              stroke="var(--color-profitMargin)"
              strokeWidth={2}
              type="monotone"
              yAxisId="right"
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});
ReportProfitTrendChart.displayName = "ReportProfitTrendChart";
