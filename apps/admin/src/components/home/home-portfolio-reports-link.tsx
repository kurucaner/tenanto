import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3 } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { homeApi } from "@/lib/api-client";
import { formatHomePortfolioReportsKpi } from "@/lib/home-portfolio-reports-kpi";
import { queryKeys } from "@/lib/query-keys";

export const HomePortfolioReportsLink = memo(() => {
  const overviewQuery = useQuery({
    queryFn: () => homeApi.financialOverview(),
    queryKey: queryKeys.homeFinancialOverview(),
  });

  const overview = overviewQuery.data?.overview;
  const kpiLine = overview ? formatHomePortfolioReportsKpi(overview) : null;

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-primary">
          <BarChart3 className="size-4" />
          <CardTitle className="text-base font-semibold">Portfolio reports</CardTitle>
        </div>
        {overviewQuery.isPending ? (
          <Skeleton className="h-4 w-64 max-w-full" />
        ) : kpiLine ? (
          <CardDescription>{kpiLine}</CardDescription>
        ) : (
          <CardDescription>
            View income, expenses, and net performance across your properties.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Button asChild className="gap-2" variant="secondary">
          <Link to="/reports">
            View portfolio reports
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
});
HomePortfolioReportsLink.displayName = "HomePortfolioReportsLink";
