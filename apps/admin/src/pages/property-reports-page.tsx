import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { formatExpenseCategoryLabel } from "@/components/expenses/expense-form-options";
import {
  CHANNEL_OPTIONS,
  formatChannelLabel,
  reservationSelectClassName,
} from "@/components/income/reservation-form-options";
import { PropertyPageShell } from "@/components/properties/property-page-shell";
import { ReportSectionTable } from "@/components/reports/report-section-table";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { propertiesApi, reportsApi, unitsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  ReportRentalTypeFilter,
  type IPropertyReportsQuery,
  type TReportRentalTypeFilter,
} from "@/packages/shared";

const reportSelectClassName = cn(
  reservationSelectClassName,
  "bg-background"
);

const RENTAL_TYPE_FILTER_OPTIONS: { label: string; value: TReportRentalTypeFilter | "" }[] = [
  { label: "Both", value: "" },
  { label: "Short term", value: ReportRentalTypeFilter.SHORT_TERM },
  { label: "Long term", value: ReportRentalTypeFilter.LONG_TERM },
];

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const PropertyReportsContent = memo(
  ({ propertyId, propertyName }: { propertyId: string; propertyName: string }) => {
    const defaults = useMemo(() => getDefaultDateRange(), []);
    const [from, setFrom] = useState(defaults.from);
    const [to, setTo] = useState(defaults.to);
    const [unitId, setUnitId] = useState("");
    const [channel, setChannel] = useState("");
    const [rentalType, setRentalType] = useState("");
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
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `property-${propertyId}-report-${reportQuery.from}-${reportQuery.to}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Report downloaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to download report");
      } finally {
        setIsExporting(false);
      }
    };

    const actions = (
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
      <PropertyPageShell actions={actions} propertyId={propertyId} propertyName={propertyName}>
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="report-from">From</Label>
                <Input
                  id="report-from"
                  onChange={(e) => setFrom(e.target.value)}
                  type="date"
                  value={from}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-to">To</Label>
                <Input
                  id="report-to"
                  onChange={(e) => setTo(e.target.value)}
                  type="date"
                  value={to}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-unit">Unit</Label>
                <select
                  className={reportSelectClassName}
                  id="report-unit"
                  onChange={(e) => setUnitId(e.target.value)}
                  value={unitId}
                >
                  <option value="">All units</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unitNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-channel">Channel</Label>
                <select
                  className={reportSelectClassName}
                  id="report-channel"
                  onChange={(e) => setChannel(e.target.value)}
                  value={channel}
                >
                  <option value="">All channels</option>
                  {CHANNEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-rental-type">Rental type</Label>
                <select
                  className={reportSelectClassName}
                  id="report-rental-type"
                  onChange={(e) => setRentalType(e.target.value)}
                  value={rentalType}
                >
                  {RENTAL_TYPE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value || "both"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {rentalType ? (
              <p className="text-muted-foreground text-xs">
                Expenses are property-wide and included when the property has units of the selected
                rental type.
              </p>
            ) : null}

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
                      <TableCell className="text-right">
                        {formatMoney(row.channelCommission)}
                      </TableCell>
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
                      <TableCell className="text-right">{formatPercent(row.occupancyRate)}</TableCell>
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
      </PropertyPageShell>
    );
  }
);
PropertyReportsContent.displayName = "PropertyReportsContent";

const PropertyReportsPageInner = memo(() => {
  const { propertyId } = useParams<{ propertyId: string }>();

  const propertyQuery = useQuery({
    enabled: Boolean(propertyId),
    queryFn: () => propertiesApi.getDetail(propertyId!), // NOSONAR
    queryKey: adminQueryKeys.propertyDetail(propertyId!), // NOSONAR
  });

  if (!propertyId) {
    return <p className="text-muted-foreground text-sm">Invalid property.</p>;
  }

  if (propertyQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (propertyQuery.isError || !propertyQuery.data?.property) {
    return (
      <p className="text-destructive text-sm">
        {propertyQuery.error instanceof Error
          ? propertyQuery.error.message
          : "Property not found"}
      </p>
    );
  }

  return (
    <PropertyReportsContent
      key={propertyId}
      propertyId={propertyId}
      propertyName={propertyQuery.data.property.name}
    />
  );
});
PropertyReportsPageInner.displayName = "PropertyReportsPageInner";

export const PropertyReportsPage = PropertyReportsPageInner;
