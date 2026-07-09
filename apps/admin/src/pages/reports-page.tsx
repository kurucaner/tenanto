import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { PortfolioPropertyTable } from "@/components/reports/portfolio-property-table";
import { ReportFiltersBar } from "@/components/reports/report-filters-bar";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { portfolioReportsApi } from "@/lib/api-client";
import { downloadReportCsv } from "@/lib/download-report-csv";
import { adminQueryKeys } from "@/lib/query-keys";
import { getDefaultReportDateRange } from "@/lib/report-date-defaults";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { type IPropertyReportsQuery, type TReportRentalTypeFilter } from "@/packages/shared";

export const ReportsPage = memo(() => {
  const defaults = useMemo(() => getDefaultReportDateRange(), []);
  const reportFilterSchema = useMemo(
    () =>
      defineUrlFilterSchema<{ from: string; rentalType: string; to: string }>({
        from: { defaultValue: defaults.from },
        rentalType: { defaultValue: "" },
        to: { defaultValue: defaults.to },
      }),
    [defaults.from, defaults.to]
  );
  const { filters, setFilter } = useUrlFilterState(reportFilterSchema);
  const { from, rentalType, to } = filters;
  const [isExporting, setIsExporting] = useState(false);

  const reportQuery = useMemo<IPropertyReportsQuery | null>(() => {
    if (!from || !to || from > to) return null;
    const next: IPropertyReportsQuery = { from, to };
    if (rentalType) next.rentalType = rentalType as TReportRentalTypeFilter;
    return next;
  }, [from, rentalType, to]);

  const summaryQuery = useQuery({
    enabled: reportQuery !== null,
    queryFn: () => portfolioReportsApi.summary(reportQuery!),
    queryKey: adminQueryKeys.portfolioReportSummary(reportQuery!),
  });

  const summary = summaryQuery.data?.summary;

  const handleExport = async () => {
    if (!reportQuery) return;
    setIsExporting(true);
    try {
      const blob = await portfolioReportsApi.exportCsv(reportQuery);
      downloadReportCsv(blob, `portfolio-report-${reportQuery.from}-${reportQuery.to}.csv`);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to download report");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AdminPageLayout
      intro={{
        actions: (
          <Button
            className="gap-1.5"
            disabled={!reportQuery || isExporting}
            onClick={() => void handleExport()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Download className="size-3.5" />
            {isExporting ? "Downloading…" : "Download CSV"}
          </Button>
        ),
        description: "Portfolio totals across all properties you can access.",
        eyebrow: "Accounting",
      }}
    >
      <Card>
        <CardContent className="space-y-4 p-4">
          <ReportFiltersBar
            from={from}
            onFromChange={(value) => setFilter("from", value)}
            onRentalTypeChange={(value) => setFilter("rentalType", value)}
            onToChange={(value) => setFilter("to", value)}
            rentalType={rentalType}
            to={to}
          />

          {!reportQuery ? (
            <p className="text-muted-foreground text-sm">
              Select a valid date range to load reports.
            </p>
          ) : summaryQuery.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : summaryQuery.isError || !summary ? (
            <p className="text-destructive text-sm">
              {summaryQuery.error instanceof Error
                ? summaryQuery.error.message
                : "Failed to load report"}
            </p>
          ) : (
            <div className="space-y-6">
              <ReportSummaryCards totals={summary.totals.totals} />
              <PortfolioPropertyTable
                from={from}
                properties={summary.properties}
                rentalType={rentalType || undefined}
                to={to}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPageLayout>
  );
});
ReportsPage.displayName = "ReportsPage";
