import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ReportChartsSection } from "@/components/reports/charts/report-charts-section";
import { ReportChartsSkeleton } from "@/components/reports/charts/report-charts-skeleton";
import { ReportFiltersBar } from "@/components/reports/report-filters-bar";
import {
  ReportSectionTable,
  type ReportTableColumnDef,
} from "@/components/reports/report-section-table";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { reportsApi, unitsApi } from "@/lib/api-client";
import { downloadReportCsv } from "@/lib/download-report-csv";
import { formatMoney } from "@/lib/format-money";
import { adminQueryKeys } from "@/lib/query-keys";
import { formatReportPercent, getDefaultReportDateRange } from "@/lib/report-date-defaults";
import { sortUnitSummaryRows } from "@/lib/report-table-sort";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  type IPropertyReportsQuery,
  type IPropertyReportSummary,
  type TReportRentalTypeFilter,
} from "@/packages/shared";

const UNIT_COLUMNS: ReportTableColumnDef[] = [
  { id: "unit", label: "Unit" },
  { align: "right", id: "gross", label: "Gross" },
  { align: "right", id: "net", label: "Net" },
  { align: "right", id: "bookedNights", label: "Booked nights" },
  { align: "right", id: "availableNights", label: "Available nights" },
  { align: "right", id: "occupancy", label: "Occupancy" },
  { align: "right", id: "adr", label: "ADR" },
];

const PropertyReportTables = memo(({ summary }: { summary: IPropertyReportSummary }) => {
  const unitSort = useUrlTableSort({
    defaultColumnId: "unit",
    defaultDirection: "asc",
    prefix: "unit",
  });

  const unitRows = useMemo(
    () => sortUnitSummaryRows(summary.byUnit, unitSort.sortState),
    [summary.byUnit, unitSort.sortState]
  );

  return (
    <div className="space-y-6">
      <ReportSummaryCards totals={summary.totals} />
      <ReportChartsSection summary={summary} />

      <ReportSectionTable
        columns={UNIT_COLUMNS}
        getColumnAriaSort={unitSort.getColumnAriaSort}
        getColumnDirection={unitSort.getColumnDirection}
        isEmpty={summary.byUnit.length === 0}
        onSortColumn={unitSort.toggleSort}
        title="Per-unit income and occupancy"
      >
        {unitRows.map((row) => (
          <TableRow key={row.unitId}>
            <TableCell>{row.unitNumber}</TableCell>
            <TableCell className="text-right">{formatMoney(row.grossIncome)}</TableCell>
            <TableCell className="text-right">{formatMoney(row.netIncome)}</TableCell>
            <TableCell className="text-right">{row.bookedNights}</TableCell>
            <TableCell className="text-right">{row.availableNights}</TableCell>
            <TableCell className="text-right">{formatReportPercent(row.occupancyRate)}</TableCell>
            <TableCell className="text-right">{formatMoney(row.adr)}</TableCell>
          </TableRow>
        ))}
      </ReportSectionTable>

      <p className="text-muted-foreground text-xs">
        Property expenses total: {formatMoney(summary.propertyExpensesTotal)} (not split by unit)
      </p>
    </div>
  );
});
PropertyReportTables.displayName = "PropertyReportTables";

interface PropertyReportBodyProps {
  error: unknown;
  isError: boolean;
  isPending: boolean;
  reportQuery: IPropertyReportsQuery | null;
  summary: IPropertyReportSummary | undefined;
}

const PropertyReportBody = memo(
  ({ error, isError, isPending, reportQuery, summary }: PropertyReportBodyProps) => {
    if (!reportQuery) {
      return (
        <p className="text-muted-foreground text-sm">Select a valid date range to load reports.</p>
      );
    }

    if (isPending) {
      return (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
          <ReportChartsSkeleton />
        </div>
      );
    }

    if (isError || !summary) {
      return (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Failed to load report"}
        </p>
      );
    }

    return <PropertyReportTables summary={summary} />;
  }
);
PropertyReportBody.displayName = "PropertyReportBody";

export const PropertyReportsPage = memo(() => {
  const { propertyId } = usePropertyShell();
  const defaultRange = useMemo(() => getDefaultReportDateRange(), []);
  const reportFilterSchema = useMemo(
    () =>
      defineUrlFilterSchema<{
        channel: string;
        from: string;
        rentalType: string;
        to: string;
        unitId: string;
      }>({
        channel: { defaultValue: "" },
        from: { defaultValue: defaultRange.from },
        rentalType: { defaultValue: "" },
        to: { defaultValue: defaultRange.to },
        unitId: { defaultValue: "" },
      }),
    [defaultRange.from, defaultRange.to]
  );
  const { filters, setFilter } = useUrlFilterState(reportFilterSchema);
  const { channel, from, rentalType, to, unitId } = filters;
  const [isExporting, setIsExporting] = useState(false);

  const reportQuery = useMemo<IPropertyReportsQuery | null>(() => {
    if (!from || !to || from > to) return null;
    const next: IPropertyReportsQuery = { from, to };
    if (unitId) next.unitId = unitId;
    if (channel) next.channel = channel as IPropertyReportsQuery["channel"];
    if (rentalType) next.rentalType = rentalType as TReportRentalTypeFilter;
    return next;
  }, [channel, from, rentalType, to, unitId]);

  const summaryQuery = useQuery({
    enabled: reportQuery !== null,
    queryFn: () => reportsApi.summary(propertyId, reportQuery!),
    queryKey: adminQueryKeys.propertyReportSummary(propertyId, reportQuery!),
  });

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: adminQueryKeys.propertyUnits(propertyId),
  });

  const units = unitsQuery.data?.units ?? [];
  const summary = summaryQuery.data?.summary;
  const handleExport = useCallback(async () => {
    if (!reportQuery) return;
    setIsExporting(true);
    try {
      const blob = await reportsApi.exportCsv(propertyId, reportQuery);
      downloadReportCsv(
        blob,
        `property-${propertyId}-report-${reportQuery.from}-${reportQuery.to}.csv`
      );
      toast.success("Report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to download report");
    } finally {
      setIsExporting(false);
    }
  }, [propertyId, reportQuery]);

  const pageActions = useMemo(
    () => (
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
    [handleExport, isExporting, reportQuery]
  );

  usePropertyShellActions(pageActions);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <ReportFiltersBar
          channel={channel}
          from={from}
          onChannelChange={(value) => setFilter("channel", value)}
          onFromChange={(value) => setFilter("from", value)}
          onRentalTypeChange={(value) => setFilter("rentalType", value)}
          onToChange={(value) => setFilter("to", value)}
          onUnitChange={(value) => setFilter("unitId", value)}
          rentalType={rentalType}
          showChannelFilter
          showUnitFilter
          to={to}
          unitId={unitId}
          units={units}
        />

        <PropertyReportBody
          error={summaryQuery.error}
          isError={summaryQuery.isError}
          isPending={summaryQuery.isPending}
          reportQuery={reportQuery}
          summary={summary}
        />
      </CardContent>
    </Card>
  );
});
PropertyReportsPage.displayName = "PropertyReportsPage";
