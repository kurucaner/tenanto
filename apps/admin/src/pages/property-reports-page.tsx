import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { formatExpenseCategoryLabel } from "@/components/expenses/expense-form-options";
import { formatChannelLabel } from "@/components/income/reservation-form-options";
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
import { useTableSort } from "@/hooks/use-table-sort";
import { reportsApi, unitsApi } from "@/lib/api-client";
import { downloadReportCsv } from "@/lib/download-report-csv";
import { formatMoney } from "@/lib/format-money";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  buildSalesTypeBreakdownRows,
  sortChannelSummaryRows,
  sortExpenseCategoryRows,
  sortMonthSummaryRows,
  sortSalesTypeRows,
  sortUnitSummaryRows,
} from "@/lib/report-table-sort";
import {
  formatReportPercent,
  getDefaultReportDateRange,
} from "@/lib/report-date-defaults";
import {
  type IPropertyReportSummary,
  type IPropertyReportsQuery,
  type TReportRentalTypeFilter,
} from "@/packages/shared";

const SALES_TYPE_COLUMNS: ReportTableColumnDef[] = [
  { id: "type", label: "Type" },
  { id: "amount", align: "right", label: "Amount" },
];

const CHANNEL_COLUMNS: ReportTableColumnDef[] = [
  { id: "channel", label: "Channel" },
  { id: "gross", align: "right", label: "Gross" },
  { id: "commission", align: "right", label: "Commission" },
  { id: "stays", align: "right", label: "Stays" },
];

const UNIT_COLUMNS: ReportTableColumnDef[] = [
  { id: "unit", label: "Unit" },
  { id: "gross", align: "right", label: "Gross" },
  { id: "net", align: "right", label: "Net" },
  { id: "bookedNights", align: "right", label: "Booked nights" },
  { id: "availableNights", align: "right", label: "Available nights" },
  { id: "occupancy", align: "right", label: "Occupancy" },
  { id: "adr", align: "right", label: "ADR" },
];

const MONTH_COLUMNS: ReportTableColumnDef[] = [
  { id: "month", label: "Month" },
  { id: "gross", align: "right", label: "Gross" },
  { id: "net", align: "right", label: "Net" },
  { id: "expenses", align: "right", label: "Expenses" },
  { id: "operationalNet", align: "right", label: "Operational net" },
];

const EXPENSE_COLUMNS: ReportTableColumnDef[] = [
  { id: "category", label: "Category" },
  { id: "amount", align: "right", label: "Amount" },
];

const PropertyReportTables = memo(({ summary }: { summary: IPropertyReportSummary }) => {
  const salesTypeSort = useTableSort("amount", "desc");
  const channelSort = useTableSort("gross", "desc");
  const unitSort = useTableSort("unit", "asc");
  const monthSort = useTableSort("month", "asc");
  const expenseSort = useTableSort("amount", "desc");

  const salesTypeRows = useMemo(
    () =>
      sortSalesTypeRows(
        buildSalesTypeBreakdownRows(summary.salesTypeBreakdown),
        salesTypeSort.sortState
      ),
    [salesTypeSort.sortState, summary.salesTypeBreakdown]
  );

  const channelRows = useMemo(
    () => sortChannelSummaryRows(summary.channelSummary, channelSort.sortState),
    [channelSort.sortState, summary.channelSummary]
  );

  const unitRows = useMemo(
    () => sortUnitSummaryRows(summary.byUnit, unitSort.sortState),
    [summary.byUnit, unitSort.sortState]
  );

  const monthRows = useMemo(
    () => sortMonthSummaryRows(summary.byMonth, monthSort.sortState),
    [monthSort.sortState, summary.byMonth]
  );

  const expenseRows = useMemo(
    () => sortExpenseCategoryRows(summary.expenseByCategory, expenseSort.sortState),
    [expenseSort.sortState, summary.expenseByCategory]
  );

  return (
    <div className="space-y-6">
      <ReportSummaryCards totals={summary.totals} />

      <ReportSectionTable
        columns={SALES_TYPE_COLUMNS}
        getColumnAriaSort={salesTypeSort.getColumnAriaSort}
        getColumnDirection={salesTypeSort.getColumnDirection}
        isEmpty={false}
        onSortColumn={salesTypeSort.toggleSort}
        title="Sales-type breakdown"
      >
        {salesTypeRows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
          </TableRow>
        ))}
      </ReportSectionTable>

      <ReportSectionTable
        columns={CHANNEL_COLUMNS}
        getColumnAriaSort={channelSort.getColumnAriaSort}
        getColumnDirection={channelSort.getColumnDirection}
        isEmpty={summary.channelSummary.length === 0}
        onSortColumn={channelSort.toggleSort}
        title="Channel summary"
      >
        {channelRows.map((row) => (
          <TableRow key={row.channel}>
            <TableCell>{formatChannelLabel(row.channel)}</TableCell>
            <TableCell className="text-right">{formatMoney(row.grossIncome)}</TableCell>
            <TableCell className="text-right">{formatMoney(row.channelCommission)}</TableCell>
            <TableCell className="text-right">{row.stayCount}</TableCell>
          </TableRow>
        ))}
      </ReportSectionTable>

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

      <ReportSectionTable
        columns={MONTH_COLUMNS}
        getColumnAriaSort={monthSort.getColumnAriaSort}
        getColumnDirection={monthSort.getColumnDirection}
        isEmpty={summary.byMonth.length === 0}
        onSortColumn={monthSort.toggleSort}
        title="Monthly trend"
      >
        {monthRows.map((row) => (
          <TableRow key={row.month}>
            <TableCell>{row.month}</TableCell>
            <TableCell className="text-right">{formatMoney(row.grossIncome)}</TableCell>
            <TableCell className="text-right">{formatMoney(row.netIncome)}</TableCell>
            <TableCell className="text-right">{formatMoney(row.expenses)}</TableCell>
            <TableCell className="text-right">{formatMoney(row.operationalNet)}</TableCell>
          </TableRow>
        ))}
      </ReportSectionTable>

      <ReportSectionTable
        columns={EXPENSE_COLUMNS}
        getColumnAriaSort={expenseSort.getColumnAriaSort}
        getColumnDirection={expenseSort.getColumnDirection}
        isEmpty={summary.expenseByCategory.length === 0}
        onSortColumn={expenseSort.toggleSort}
        title="Expenses by category"
      >
        {expenseRows.map((row) => (
          <TableRow key={row.category}>
            <TableCell>{formatExpenseCategoryLabel(row.category)}</TableCell>
            <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
          </TableRow>
        ))}
      </ReportSectionTable>
    </div>
  );
});
PropertyReportTables.displayName = "PropertyReportTables";

export const PropertyReportsPage = memo(() => {
  const { propertyId } = usePropertyShell();
  const [searchParams] = useSearchParams();
  const defaultRange = useMemo(() => getDefaultReportDateRange(), []);
  const [from, setFrom] = useState(() => searchParams.get("from") ?? defaultRange.from);
  const [to, setTo] = useState(() => searchParams.get("to") ?? defaultRange.to);
  const [unitId, setUnitId] = useState("");
  const [channel, setChannel] = useState("");
  const [rentalType, setRentalType] = useState(() => searchParams.get("rentalType") ?? "");
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

  const handleExport = async () => {
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
  };

  usePropertyShellActions(
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
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <ReportFiltersBar
          channel={channel}
          from={from}
          onChannelChange={setChannel}
          onFromChange={setFrom}
          onRentalTypeChange={setRentalType}
          onToChange={setTo}
          onUnitChange={setUnitId}
          rentalType={rentalType}
          showChannelFilter
          showUnitFilter
          to={to}
          unitId={unitId}
          units={units}
        />

        {!reportQuery ? (
          <p className="text-muted-foreground text-sm">Select a valid date range to load reports.</p>
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
          <PropertyReportTables summary={summary} />
        )}
      </CardContent>
    </Card>
  );
});
PropertyReportsPage.displayName = "PropertyReportsPage";
