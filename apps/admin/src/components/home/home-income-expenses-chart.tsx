import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format-money";
import type { IPropertyReportMonthSummary } from "@/packages/shared";

const chartConfig = {
  expenses: {
    color: "var(--chart-2)",
    label: "Expenses",
  },
  income: {
    color: "var(--chart-1)",
    label: "Gross income",
  },
} satisfies ChartConfig;

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-");
  return new Date(Date.UTC(Number(year), Number(monthNum) - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
  });
}

interface HomeIncomeExpensesChartProps {
  byMonth: IPropertyReportMonthSummary[];
}

export const HomeIncomeExpensesChart = memo(({ byMonth }: HomeIncomeExpensesChartProps) => {
  const chartData = useMemo(
    () =>
      byMonth.map((row) => ({
        expenses: row.expenses,
        income: row.grossIncome,
        month: formatMonthLabel(row.month),
      })),
    [byMonth]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Income vs expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video h-[280px] w-full" config={chartConfig}>
          <BarChart accessibilityLayer data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="month" tickLine={false} tickMargin={8} />
            <YAxis
              axisLine={false}
              tickFormatter={(value: number) =>
                value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
              }
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
            <Bar dataKey="income" fill="var(--color-income)" radius={4} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});
HomeIncomeExpensesChart.displayName = "HomeIncomeExpensesChart";
