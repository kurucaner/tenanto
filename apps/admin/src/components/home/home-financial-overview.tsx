import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { HomeFinancialSkeleton } from "@/components/home/home-financial-skeleton";
import { ReportExpenseBreakdownChart } from "@/components/reports/charts/report-expense-breakdown-chart";
import { ReportIncomeExpensesChart } from "@/components/reports/charts/report-income-expenses-chart";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { homeApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";

function formatPeriodLabel(from: string, to: string): string {
  const fromDate = new Date(`${from}T12:00:00Z`);
  const toDate = new Date(`${to}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
  return `${formatter.format(fromDate)} – ${formatter.format(toDate)}`;
}

function formatPropertyCount(count: number): string {
  const label = count === 1 ? "property" : "properties";
  return `${count} ${label}`;
}

export const HomeFinancialOverview = memo(() => {
  const overviewQuery = useQuery({
    queryFn: () => homeApi.financialOverview(),
    queryKey: adminQueryKeys.homeFinancialOverview(),
  });

  const overview = overviewQuery.data?.overview;

  return (
    <section aria-label="Financial overview" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Financial overview</h2>
          {overview ? (
            <p className="text-muted-foreground text-sm">
              Last 6 months · {formatPeriodLabel(overview.period.from, overview.period.to)}
              {overview.propertyCount > 0
                ? ` · ${formatPropertyCount(overview.propertyCount)}`
                : null}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Last 6 months across your portfolio</p>
          )}
        </div>
        <Button asChild className="gap-1.5" size="sm" variant="outline">
          <Link to="/reports">
            View full reports
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      {overviewQuery.isPending ? <HomeFinancialSkeleton /> : null}

      {overviewQuery.isError ? (
        <p className="text-destructive text-sm">
          {overviewQuery.error instanceof Error
            ? overviewQuery.error.message
            : "Could not load financial overview."}
        </p>
      ) : null}

      {overview && overview.propertyCount === 0 ? (
        <Card className="border-border/80 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">No property data yet</CardTitle>
            <CardDescription>
              Once you are assigned to a property, your income and expense trends will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="gap-2" variant="secondary">
              <Link to="/properties">
                Browse properties
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {overview && overview.propertyCount > 0 ? (
        <div className="space-y-6">
          <ReportSummaryCards totals={overview.totals} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportIncomeExpensesChart byMonth={overview.byMonth} />
            <ReportExpenseBreakdownChart
              expenseByCategory={overview.expenseByCategory}
              title="Top expenses"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
});
HomeFinancialOverview.displayName = "HomeFinancialOverview";
