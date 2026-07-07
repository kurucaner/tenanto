import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatExpenseCategoryLabel } from "@/components/expenses/expense-form-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format-money";
import type { IPropertyReportExpenseCategory } from "@/packages/shared";

const chartConfig = {
  amount: {
    color: "var(--chart-3)",
    label: "Amount",
  },
} satisfies ChartConfig;

interface HomeExpenseBreakdownChartProps {
  expenseByCategory: IPropertyReportExpenseCategory[];
}

export const HomeExpenseBreakdownChart = memo(
  ({ expenseByCategory }: HomeExpenseBreakdownChartProps) => {
    const chartData = useMemo(
      () =>
        expenseByCategory.map((row) => ({
          amount: row.amount,
          category: formatExpenseCategoryLabel(row.category),
        })),
      [expenseByCategory]
    );

    if (chartData.length === 0) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top expenses</CardTitle>
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
          <CardTitle className="text-base font-semibold">Top expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer className="aspect-video h-[280px] w-full" config={chartConfig}>
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
                dataKey="category"
                tickLine={false}
                type="category"
                width={120}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatMoney(Number(value))}
                    hideLabel
                    indicator="dot"
                  />
                }
              />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }
);
HomeExpenseBreakdownChart.displayName = "HomeExpenseBreakdownChart";
