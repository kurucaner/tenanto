import { useQuery } from "@tanstack/react-query";
import { memo, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { formatExpenseCategoryLabel } from "@/components/expenses/expense-form-options";
import { formatChannelLabel } from "@/components/income/reservation-form-options";
import { usePropertyShell } from "@/components/properties/property-shell-context";
import { ReportFiltersBar } from "@/components/reports/report-filters-bar";
import { ReportSectionTable } from "@/components/reports/report-section-table";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { reportsApi, unitsApi } from "@/lib/api-client";
import { downloadReportCsv } from "@/lib/download-report-csv";
import { formatMoney } from "@/lib/format-money";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  formatReportPercent,
  getDefaultReportDateRange,
} from "@/lib/report-date-defaults";
import {
  type IPropertyReportsQuery,
  type TReportRentalTypeFilter,
} from "@/packages/shared";

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

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <ReportFiltersBar
          channel={channel}
          from={from}
          isExportDisabled={!reportQuery}
          isExporting={isExporting}
          onChannelChange={setChannel}
          onExport={() => void handleExport()}
          onFromChange={setFrom}
          onRentalTypeChange={setRentalType}
          onToChange={setTo}
          onUnitChange={setUnitId}
          rentalType={rentalType}
          showChannelFilter
          showExport
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
          <div className="space-y-6">
            <ReportSummaryCards totals={summary.totals} />

            <ReportSectionTable
              columns={["Type", "Amount"]}
              isEmpty={false}
              title="Sales-type breakdown"
            >
              <TableRow>
                <TableCell>Room</TableCell>
                <TableCell className="text-right">
                  {formatMoney(summary.salesTypeBreakdown.room)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Cleaning (total)</TableCell>
                <TableCell className="text-right">
                  {formatMoney(summary.salesTypeBreakdown.totalCleaning)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Extra cleaning</TableCell>
                <TableCell className="text-right">
                  {formatMoney(summary.salesTypeBreakdown.extraCleaning)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Extra service</TableCell>
                <TableCell className="text-right">
                  {formatMoney(summary.salesTypeBreakdown.extraService)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Beach rental</TableCell>
                <TableCell className="text-right">
                  {formatMoney(summary.salesTypeBreakdown.beachRental)}
                </TableCell>
              </TableRow>
            </ReportSectionTable>

            <ReportSectionTable
              columns={["Channel", "Gross", "Commission", "Stays"]}
              isEmpty={summary.channelSummary.length === 0}
              title="Channel summary"
            >
              {summary.channelSummary.map((row) => (
                <TableRow key={row.channel}>
                  <TableCell>{formatChannelLabel(row.channel)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.grossIncome)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.channelCommission)}</TableCell>
                  <TableCell className="text-right">{row.stayCount}</TableCell>
                </TableRow>
              ))}
            </ReportSectionTable>

            <ReportSectionTable
              columns={[
                "Unit",
                "Gross",
                "Net",
                "Booked nights",
                "Available nights",
                "Occupancy",
                "ADR",
              ]}
              isEmpty={summary.byUnit.length === 0}
              title="Per-unit income and occupancy"
            >
              {summary.byUnit.map((row) => (
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
              Property expenses total: {formatMoney(summary.propertyExpensesTotal)} (not split by
              unit)
            </p>

            <ReportSectionTable
              columns={["Month", "Gross", "Net", "Expenses", "Operational net"]}
              isEmpty={summary.byMonth.length === 0}
              title="Monthly trend"
            >
              {summary.byMonth.map((row) => (
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
              columns={["Category", "Amount"]}
              isEmpty={summary.expenseByCategory.length === 0}
              title="Expenses by category"
            >
              {summary.expenseByCategory.map((row) => (
                <TableRow key={row.category}>
                  <TableCell>{formatExpenseCategoryLabel(row.category)}</TableCell>
                  <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                </TableRow>
              ))}
            </ReportSectionTable>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
PropertyReportsPage.displayName = "PropertyReportsPage";
