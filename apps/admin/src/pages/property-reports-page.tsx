import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { buildChannelOptions } from "@/components/income/reservation-form-options";
import { ReportChartsSection } from "@/components/reports/charts/report-charts-section";
import { ReportChartsSkeleton } from "@/components/reports/charts/report-charts-skeleton";
import { PropertyReportToolbar } from "@/components/reports/property-report-toolbar";
import { type TReportFilterKey } from "@/components/reports/report-filter-panel";
import { RENTAL_TYPE_FILTER_OPTIONS } from "@/components/reports/report-form-options";
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
import { useUrlDateRangeFilter } from "@/hooks/use-url-date-range-filter";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { reportsApi, settingsApi, unitsApi } from "@/lib/api-client";
import { getDateRangeSummary } from "@/lib/date-range-presets";
import { downloadReportCsv } from "@/lib/download-report-csv";
import { formatMoney } from "@/lib/format-money";
import { LEDGER_CARD_HORIZONTAL_INSET } from "@/lib/ledger-filter-grid";
import { queryKeys } from "@/lib/query-keys";
import { formatReportPercent, getDefaultReportDateRange } from "@/lib/report-date-defaults";
import { sortUnitSummaryRows } from "@/lib/report-table-sort";
import {
  buildReportToolbarClearAllPatch,
  buildReportToolbarClearOnePatch,
  buildReportToolbarFilterItems,
  countReportSecondaryFilters,
  type TReportToolbarFilterId,
} from "@/lib/report-toolbar-filters";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { cn } from "@/lib/utils";
import {
  formatPropertyUnitSelectLabel,
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

function buildReportQuery(
  effectiveFrom: string,
  effectiveTo: string,
  unitId: string,
  channelCommissionId: string,
  rentalType: string
): IPropertyReportsQuery | null {
  if (!effectiveFrom || !effectiveTo || effectiveFrom > effectiveTo) return null;
  const next: IPropertyReportsQuery = { from: effectiveFrom, to: effectiveTo };
  if (unitId) next.unitId = unitId;
  if (channelCommissionId) next.channelCommissionId = channelCommissionId;
  if (rentalType) next.rentalType = rentalType as TReportRentalTypeFilter;
  return next;
}

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
        allTime: string;
        channelCommissionId: string;
        from: string;
        rentalType: string;
        to: string;
        unitId: string;
      }>({
        allTime: { defaultValue: "" },
        channelCommissionId: { defaultValue: "" },
        from: { defaultValue: defaultRange.from },
        rentalType: { defaultValue: "" },
        to: { defaultValue: defaultRange.to },
        unitId: { defaultValue: "" },
      }),
    [defaultRange.from, defaultRange.to]
  );
  const { filters, setFilter, setFilters } = useUrlFilterState(reportFilterSchema);
  const { allTime: allTimeParam, channelCommissionId, from, rentalType, to, unitId } = filters;
  const allTime = allTimeParam === "true";
  const {
    activePreset,
    displayFrom,
    displayTo,
    effectiveFrom,
    effectiveTo,
    onFromChange,
    onPresetChange,
    onToChange,
  } = useUrlDateRangeFilter({
    allTime,
    allTimeDefault: false,
    dateFilterSchema: reportFilterSchema,
    from,
    to,
  });
  const [isExporting, setIsExporting] = useState(false);

  const reportQuery = useMemo(
    () => buildReportQuery(effectiveFrom, effectiveTo, unitId, channelCommissionId, rentalType),
    [channelCommissionId, effectiveFrom, effectiveTo, rentalType, unitId]
  );

  const summaryQuery = useQuery({
    enabled: reportQuery !== null,
    queryFn: () => reportsApi.summary(propertyId, reportQuery!),
    queryKey: queryKeys.propertyReportSummary(propertyId, reportQuery!),
  });

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: queryKeys.propertyUnits(propertyId),
  });

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: queryKeys.propertySettings(propertyId),
  });

  const channelFilterOptions = useMemo(
    () => buildChannelOptions(settingsQuery.data?.settings.channelCommissions ?? []),
    [settingsQuery.data?.settings.channelCommissions]
  );

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);
  const activeUnits = useMemo(() => units.filter((unit) => !unit.isDeleted), [units]);
  const unitFilterOptions = useMemo(
    () =>
      activeUnits.map((unit) => ({
        label: formatPropertyUnitSelectLabel(unit),
        value: unit.id,
      })),
    [activeUnits]
  );

  const activeSecondaryFilterCount = useMemo(
    () => countReportSecondaryFilters({ channelCommissionId, rentalType, unitId }),
    [channelCommissionId, rentalType, unitId]
  );

  const dateSummary = getDateRangeSummary(activePreset, displayFrom, displayTo);
  const activeFilterItems = useMemo(
    () =>
      buildReportToolbarFilterItems({
        activePreset,
        channelCommissionId,
        channelOptions: channelFilterOptions,
        dateSummary,
        isDefaultDateRange: !allTime && from === defaultRange.from && to === defaultRange.to,
        rentalType,
        rentalTypeOptions: RENTAL_TYPE_FILTER_OPTIONS,
        unitId,
        unitOptions: unitFilterOptions,
      }),
    [
      activePreset,
      allTime,
      channelCommissionId,
      channelFilterOptions,
      dateSummary,
      defaultRange.from,
      defaultRange.to,
      from,
      rentalType,
      to,
      unitFilterOptions,
      unitId,
    ]
  );

  const handleReportFilterChange = useCallback(
    (key: TReportFilterKey, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  const handleClearSecondaryFilters = useCallback(() => {
    setFilters({ channelCommissionId: "", rentalType: "", unitId: "" });
  }, [setFilters]);

  const handleRemoveToolbarFilter = useCallback(
    (id: TReportToolbarFilterId) => {
      setFilters(buildReportToolbarClearOnePatch(id, defaultRange));
    },
    [defaultRange, setFilters]
  );

  const handleClearAllToolbarFilters = useCallback(() => {
    setFilters(buildReportToolbarClearAllPatch(defaultRange));
  }, [defaultRange, setFilters]);

  const rentalTypeNote = rentalType
    ? "Expenses are property-wide and included when the property has units of the selected rental type."
    : undefined;

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
    <Card className="gap-0 py-0">
      <CardContent className="space-y-4 p-0">
        <PropertyReportToolbar
          activeFilterCount={activeSecondaryFilterCount}
          activeFilterItems={activeFilterItems}
          activePreset={activePreset}
          channelCommissionId={channelCommissionId}
          channelOptions={channelFilterOptions}
          from={displayFrom}
          onClearAll={handleClearAllToolbarFilters}
          onClearSecondaryFilters={handleClearSecondaryFilters}
          onFilterChange={handleReportFilterChange}
          onFromChange={onFromChange}
          onPresetChange={onPresetChange}
          onRemoveFilter={handleRemoveToolbarFilter}
          onToChange={onToChange}
          rentalType={rentalType}
          rentalTypeNote={rentalTypeNote}
          to={displayTo}
          unitId={unitId}
          units={units}
        />

        <div className={cn("space-y-6 pb-4", LEDGER_CARD_HORIZONTAL_INSET)}>
          <PropertyReportBody
            error={summaryQuery.error}
            isError={summaryQuery.isError}
            isPending={summaryQuery.isPending}
            reportQuery={reportQuery}
            summary={summary}
          />
        </div>
      </CardContent>
    </Card>
  );
});
PropertyReportsPage.displayName = "PropertyReportsPage";
