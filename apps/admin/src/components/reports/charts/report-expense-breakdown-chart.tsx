import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format-money";
import {
  getExpenseBreakdownChartHeight,
  getExpenseBreakdownScrollMaxHeight,
} from "@/lib/report-chart-layout";
import type { IPropertyReportExpenseCategory } from "@/packages/shared";

const chartConfig = {
  amount: {
    color: "var(--chart-3)",
    label: "Amount",
  },
} satisfies ChartConfig;

interface ReportExpenseBreakdownChartProps {
  expenseByCategory: IPropertyReportExpenseCategory[];
  title?: string;
}

export const ReportExpenseBreakdownChart = memo(
  ({ expenseByCategory, title = "Expenses by category" }: ReportExpenseBreakdownChartProps) => {
    const chartData = useMemo(
      () =>
        [...expenseByCategory]
          .sort((a, b) => b.amount - a.amount)
          .map((row) => ({
            amount: row.amount,
            categoryId: row.categoryId,
            label: row.name,
          })),
      [expenseByCategory]
    );

    const chartHeight = getExpenseBreakdownChartHeight(chartData.length);
    const scrollMaxHeight = getExpenseBreakdownScrollMaxHeight();

    if (chartData.length === 0) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No expenses recorded in this period.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-y-auto" style={{ maxHeight: scrollMaxHeight }}>
            <ChartContainer
              className="w-full"
              config={chartConfig}
              initialDimension={{ height: chartHeight, width: 320 }}
              style={{ height: chartHeight }}
            >
              <BarChart
                accessibilityLayer
                data={chartData}
                layout="vertical"
                margin={{ bottom: 8, left: 8, right: 16, top: 8 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis
                  axisLine={false}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
                  }
                  tickLine={false}
                  type="number"
                />
                <YAxis
                  axisLine={false}
                  dataKey="label"
                  interval={0}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  type="category"
                  width={148}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatMoney(Number(value))}
                      indicator="dot"
                      labelKey="label"
                    />
                  }
                />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    );
  }
);
ReportExpenseBreakdownChart.displayName = "ReportExpenseBreakdownChart";
