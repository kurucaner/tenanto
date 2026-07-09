import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatChartMoneyAxis } from "@/lib/format-chart-money-axis";
import { formatMoney } from "@/lib/format-money";
import { formatReportMonthLabel } from "@/lib/report-date-defaults";
import {
  buildRevenueExpenseTrendChartRows,
  type IPropertyReportMonthSummary,
} from "@/packages/shared";

const chartConfig = {
  expenses: {
    color: "var(--chart-3)",
    label: "Expenses",
  },
  grossIncome: {
    color: "var(--chart-1)",
    label: "Gross income",
  },
} satisfies ChartConfig;

interface RevenueExpenseTrendChartDatum {
  expenses: number;
  grossIncome: number;
  month: string;
  monthLabel: string;
}

function buildRevenueExpenseInsight(data: RevenueExpenseTrendChartDatum[]): string | null {
  if (data.length === 0) return null;

  const totalGross = data.reduce((sum, row) => sum + row.grossIncome, 0);
  const totalExpenses = data.reduce((sum, row) => sum + row.expenses, 0);

  return `Period total: ${formatMoney(totalGross)} revenue · ${formatMoney(totalExpenses)} expenses`;
}

interface ReportRevenueExpenseTrendChartProps {
  byMonth: IPropertyReportMonthSummary[];
}

export const ReportRevenueExpenseTrendChart = memo(
  ({ byMonth }: ReportRevenueExpenseTrendChartProps) => {
    const chartData = useMemo(
      (): RevenueExpenseTrendChartDatum[] =>
        buildRevenueExpenseTrendChartRows(byMonth).map((row) => ({
          expenses: row.expenses,
          grossIncome: row.grossIncome,
          month: row.month,
          monthLabel: formatReportMonthLabel(row.month),
        })),
      [byMonth]
    );

    const insight = useMemo(() => buildRevenueExpenseInsight(chartData), [chartData]);

    if (chartData.length === 0) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue vs expenses</CardTitle>
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
          <CardTitle className="text-base font-semibold">Revenue vs expenses</CardTitle>
          {insight ? <CardDescription>{insight}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <ChartContainer className="aspect-video h-[280px] w-full" config={chartConfig}>
            <BarChart accessibilityLayer data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis axisLine={false} dataKey="monthLabel" tickLine={false} tickMargin={8} />
              <YAxis
                axisLine={false}
                tickFormatter={formatChartMoneyAxis}
                tickLine={false}
                tickMargin={8}
                width={48}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatMoney(Number(value))}
                    indicator="dot"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="grossIncome" fill="var(--color-grossIncome)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }
);
ReportRevenueExpenseTrendChart.displayName = "ReportRevenueExpenseTrendChart";
