import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, MoreHorizontal, Plus, SquarePen } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { type DataTableColumn } from "@/components/data-table/data-table-types";
import { PropertyTableExportDialog } from "@/components/exports/property-table-export-dialog";
import { EndLeaseDialog } from "@/components/leases/end-lease-dialog";
import { type TLeaseFilterKey } from "@/components/leases/lease-filter-panel";
import { PropertyLeaseToolbar } from "@/components/leases/property-lease-toolbar";
import { TableIconButton } from "@/components/table/table-icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import {
  type TPropertyLongStaysListFilters,
  usePropertyLongStaysInfiniteList,
} from "@/hooks/use-property-long-stays-infinite-list";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useUrlDateRangeFilter } from "@/hooks/use-url-date-range-filter";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { settingsApi, unitsApi } from "@/lib/api-client";
import { getDateRangeSummary } from "@/lib/date-range-presets";
import { getFilteredTableFetchState } from "@/lib/filtered-table-fetch-state";
import { formatIsoDateDisplay } from "@/lib/format-iso-date";
import { formatMoney } from "@/lib/format-money";
import { getLeaseRentAmountSuffix } from "@/lib/lease-rent-schedule-display";
import {
  buildLeaseToolbarClearAllPatch,
  buildLeaseToolbarClearOnePatch,
  buildLeaseToolbarFilterItems,
  countLeaseSecondaryFilters,
  LEASE_STATUS_FILTER_ALL,
  LEASE_STATUS_FILTER_OPTIONS,
  type TLeaseToolbarFilterId,
} from "@/lib/lease-toolbar-filters";
import {
  buildExportFilterSummaryOptions,
  formatPropertyTableExportFilterSummary,
} from "@/lib/property-export-utils";
import { queryKeys } from "@/lib/query-keys";
import { getDefaultReportDateRange } from "@/lib/report-date-defaults";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { buildPropertyStartLeasePath } from "@/lib/start-lease-routes";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  ExportResourceType,
  formatPropertyUnitSelectLabel,
  getLeaseOccupancyNames,
  type IPropertyLongStay,
  type IPropertyLongStayDetailResponse,
  isActiveLeaseInHoldover,
  LEASES_DEFAULT_SORT_BY,
  LEASES_DEFAULT_SORT_DIR,
  LEASES_SORT_BY_VALUES,
  LEASES_SORT_DIR_VALUES,
  PropertyLongStayStatus,
  type TPropertyLongStaysListSortBy,
  type TPropertyLongStaysListSortDir,
  type TPropertyLongStayStatus,
} from "@/packages/shared";

const LEASE_ROW_ESTIMATED_HEIGHT = 44;

const LEASE_COLUMNS: DataTableColumn[] = [
  { id: "unit", label: "Unit", sortable: true },
  { id: "tenant", label: "Tenant", sortable: true },
  { id: "start", label: "Start", sortable: true },
  { id: "end", label: "End", sortable: true },
  { align: "right", id: "rent", label: "Rent", sortable: true },
  { id: "status", label: "Status", sortable: true },
  { id: "actions", label: "Actions" },
];

function isLeaseListSortBy(value: string): value is TPropertyLongStaysListSortBy {
  return (LEASES_SORT_BY_VALUES as readonly string[]).includes(value);
}

function isLeaseListSortDir(value: string): value is TPropertyLongStaysListSortDir {
  return (LEASES_SORT_DIR_VALUES as readonly string[]).includes(value);
}

function getLeaseKey(lease: IPropertyLongStay): string {
  return lease.id;
}

function buildLeaseListFilters(
  effectiveFrom: string,
  effectiveTo: string,
  q: string,
  sortBy: TPropertyLongStaysListSortBy,
  sortDir: TPropertyLongStaysListSortDir,
  status: string,
  unitId: string
): TPropertyLongStaysListFilters {
  const next: TPropertyLongStaysListFilters = {};
  if (effectiveFrom) next.from = effectiveFrom;
  if (effectiveTo) next.to = effectiveTo;
  if (status && status !== LEASE_STATUS_FILTER_ALL) next.status = status as TPropertyLongStayStatus;
  if (unitId) next.unitId = unitId;
  if (sortBy) next.sortBy = sortBy;
  if (sortDir) next.sortDir = sortDir;
  const qTrim = q.trim();
  if (qTrim) next.q = qTrim;
  return next;
}

const LeaseRow = memo(
  ({
    canManage,
    lease,
    leaseDetailPath,
    onEndLease,
    unitLabel,
  }: {
    canManage: boolean;
    lease: IPropertyLongStay;
    leaseDetailPath: string;
    onEndLease: (lease: IPropertyLongStay) => void;
    unitLabel: string;
  }) => {
    const navigate = useNavigate();
    const endDate = lease.actualEndDate ?? lease.leaseEndDate;
    const tenantNames = getLeaseOccupancyNames(lease);
    const isInHoldover = isActiveLeaseInHoldover(lease, getTodayLocalIsoDate());

    const handleRowClick = useCallback(() => {
      navigate(leaseDetailPath);
    }, [navigate, leaseDetailPath]);

    return (
      <TableRow className="cursor-pointer" onClick={handleRowClick}>
        <TableCell className="font-medium">{unitLabel}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {tenantNames.map((name, index) => (
              <Badge key={`${name}-${index}`} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>{formatIsoDateDisplay(lease.leaseStartDate)}</TableCell>
        <TableCell>{formatIsoDateDisplay(endDate)}</TableCell>
        <TableCell className="text-right">
          {formatMoney(lease.monthlyRent)}
          {getLeaseRentAmountSuffix(lease.rentBillingCadence)}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-1">
            <Badge
              variant={lease.status === PropertyLongStayStatus.ACTIVE ? "default" : "secondary"}
            >
              {lease.status === PropertyLongStayStatus.ACTIVE ? "Active" : "Ended"}
            </Badge>
            {isInHoldover ? <Badge variant="outline">Holdover</Badge> : null}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <TableIconButton
              ariaLabel="View lease"
              onClick={(event) => {
                event.stopPropagation();
                navigate(leaseDetailPath);
              }}
              tooltip="View lease"
            >
              <Eye className="size-3.5" />
            </TableIconButton>
            {canManage && lease.status === PropertyLongStayStatus.ACTIVE ? (
              <TableIconButton
                ariaLabel="End lease"
                onClick={(event) => {
                  event.stopPropagation();
                  onEndLease(lease);
                }}
                tooltip="End lease"
              >
                <SquarePen className="size-3.5" />
              </TableIconButton>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
    );
  }
);
LeaseRow.displayName = "LeaseRow";

export const PropertyLeasesPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const defaultDateRange = useMemo(() => getDefaultReportDateRange(), []);
  const leaseFilterSchema = useMemo(
    () =>
      defineUrlFilterSchema<{
        allTime: string;
        from: string;
        q: string;
        status: string;
        to: string;
        unitId: string;
      }>({
        allTime: { defaultValue: "true" },
        from: { defaultValue: defaultDateRange.from },
        q: { defaultValue: "" },
        status: { defaultValue: PropertyLongStayStatus.ACTIVE },
        to: { defaultValue: defaultDateRange.to },
        unitId: { defaultValue: "" },
      }),
    [defaultDateRange.from, defaultDateRange.to]
  );

  const { filters, setFilter, setFilters } = useUrlFilterState(leaseFilterSchema);
  const { allTime: allTimeParam, from, q, status, to, unitId } = filters;
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
    allTimeDefault: true,
    dateFilterSchema: leaseFilterSchema,
    from,
    to,
  });
  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );
  const sortController = useUrlTableSort({
    defaultColumnId: LEASES_DEFAULT_SORT_BY,
    defaultDirection: LEASES_DEFAULT_SORT_DIR,
  });
  const { sortState } = sortController;

  const [exportTableOpen, setExportTableOpen] = useState(false);
  const [endLease, setEndLease] = useState<IPropertyLongStay | null>(null);

  const listQueryFilters = useMemo(
    () =>
      buildLeaseListFilters(
        effectiveFrom,
        effectiveTo,
        q,
        isLeaseListSortBy(sortState.columnId) ? sortState.columnId : LEASES_DEFAULT_SORT_BY,
        isLeaseListSortDir(sortState.direction) ? sortState.direction : LEASES_DEFAULT_SORT_DIR,
        status,
        unitId
      ),
    [effectiveFrom, effectiveTo, q, sortState.columnId, sortState.direction, status, unitId]
  );

  const { fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPending, longStays, meta } =
    usePropertyLongStaysInfiniteList(propertyId, listQueryFilters);

  const { isFilterRefetching, isTableInitialPending } = getFilteredTableFetchState({
    isFetching,
    isFetchingNextPage,
    isPending,
    itemCount: longStays.length,
  });

  const scrollSentinelRef = useInfiniteScrollTrigger({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: queryKeys.propertyUnits(propertyId),
  });

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: queryKeys.propertySettings(propertyId),
  });

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);
  const activeUnits = useMemo(() => units.filter((unit) => !unit.isDeleted), [units]);

  const unitLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of units) {
      map.set(unit.id, formatPropertyUnitSelectLabel(unit));
    }
    return map;
  }, [units]);

  const unitFilterOptions = useMemo(
    () =>
      activeUnits.map((unit) => ({
        label: formatPropertyUnitSelectLabel(unit),
        value: unit.id,
      })),
    [activeUnits]
  );

  const activeSecondaryFilterCount = useMemo(
    () => countLeaseSecondaryFilters({ status, unitId }),
    [status, unitId]
  );

  const dateSummary = getDateRangeSummary(activePreset, displayFrom, displayTo);
  const activeFilterItems = useMemo(
    () =>
      buildLeaseToolbarFilterItems({
        activePreset,
        allTime,
        dateSummary,
        q,
        status,
        statusOptions: LEASE_STATUS_FILTER_OPTIONS,
        unitId,
        unitOptions: unitFilterOptions,
      }),
    [activePreset, allTime, dateSummary, q, status, unitFilterOptions, unitId]
  );

  const handleLeaseFilterChange = useCallback(
    (key: TLeaseFilterKey, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  const handleClearSecondaryFilters = useCallback(() => {
    setFilters({ status: PropertyLongStayStatus.ACTIVE, unitId: "" });
  }, [setFilters]);

  const handleRemoveToolbarFilter = useCallback(
    (id: TLeaseToolbarFilterId) => {
      if (id === "q") {
        handleSearchInputChange("");
        return;
      }
      setFilters(buildLeaseToolbarClearOnePatch(id, defaultDateRange));
    },
    [defaultDateRange, handleSearchInputChange, setFilters]
  );

  const handleClearAllToolbarFilters = useCallback(() => {
    handleSearchInputChange("");
    setFilters(buildLeaseToolbarClearAllPatch(defaultDateRange));
  }, [defaultDateRange, handleSearchInputChange, setFilters]);

  const handleOpenCreate = useCallback(() => {
    navigate(buildPropertyStartLeasePath(propertyId, { from: "leases" }));
  }, [navigate, propertyId]);

  const handleOpenExportTable = useCallback(() => {
    setExportTableOpen(true);
  }, []);

  const exportFilterSummaryOptions = useMemo(
    () =>
      buildExportFilterSummaryOptions(settingsQuery.data?.settings, unitsQuery.data?.units ?? []),
    [settingsQuery.data?.settings, unitsQuery.data?.units]
  );

  const leaseExportFilterSummary = useMemo(
    () =>
      formatPropertyTableExportFilterSummary(
        { filters: listQueryFilters, resourceType: ExportResourceType.LEASES },
        exportFilterSummaryOptions
      ),
    [exportFilterSummaryOptions, listQueryFilters]
  );

  const pageActions = useMemo(
    () => (
      <div className="flex items-center gap-2">
        {canManage ? (
          <Button className="gap-1.5" onClick={handleOpenCreate} size="sm" type="button">
            <Plus className="size-3.5" />
            Start Lease
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="More lease actions" size="icon-sm" type="button" variant="outline">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={handleOpenExportTable}>
              <Download />
              Export table
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    [canManage, handleOpenCreate, handleOpenExportTable]
  );

  usePropertyShellActions(pageActions);

  const renderLeaseRow = useCallback(
    (lease: IPropertyLongStay) => (
      <LeaseRow
        canManage={canManage}
        key={lease.id}
        lease={lease}
        leaseDetailPath={`/properties/${propertyId}/leases/${lease.id}`}
        onEndLease={setEndLease}
        unitLabel={unitLabelById.get(lease.unitId) ?? lease.unitId}
      />
    ),
    [canManage, propertyId, unitLabelById]
  );

  const countLabel = meta
    ? `${meta.totalCount} leases · ${meta.activeCount} active · ${meta.endedCount} ended`
    : undefined;

  return (
    <>
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <DataTable
            columns={LEASE_COLUMNS}
            emptyMessage={`No leases yet.${canManage ? " Start a lease to get started." : ""}`}
            getItemKey={getLeaseKey}
            infiniteScroll={{ hasNextPage, isFetchingNextPage }}
            infiniteScrollSentinelRef={scrollSentinelRef}
            isPending={isTableInitialPending}
            isRefreshing={isFilterRefetching}
            items={longStays}
            renderRow={renderLeaseRow}
            sort={sortController}
            toolbar={
              <PropertyLeaseToolbar
                activeFilterCount={activeSecondaryFilterCount}
                activeFilterItems={activeFilterItems}
                activePreset={activePreset}
                countLabel={countLabel}
                from={displayFrom}
                onClearAll={handleClearAllToolbarFilters}
                onClearSecondaryFilters={handleClearSecondaryFilters}
                onFilterChange={handleLeaseFilterChange}
                onFromChange={onFromChange}
                onPresetChange={onPresetChange}
                onRemoveFilter={handleRemoveToolbarFilter}
                onSearchInputChange={handleSearchInputChange}
                onToChange={onToChange}
                searchInput={searchInput}
                status={status}
                statusOptions={LEASE_STATUS_FILTER_OPTIONS}
                to={displayTo}
                unitId={unitId}
                units={units}
              />
            }
            virtualization={{ estimateRowHeight: LEASE_ROW_ESTIMATED_HEIGHT }}
          />
        </CardContent>
      </Card>

      {endLease ? (
        <EndLeaseDialog
          key={endLease.id}
          lease={endLease}
          onOpenChange={(open) => {
            if (!open) setEndLease(null);
          }}
          open={true}
          propertyId={propertyId}
          rentPeriods={
            queryClient.getQueryData<IPropertyLongStayDetailResponse>(
              queryKeys.propertyLongStay(propertyId, endLease.id)
            )?.rentPeriods ?? []
          }
        />
      ) : null}

      <PropertyTableExportDialog
        config={{ filters: listQueryFilters, resourceType: ExportResourceType.LEASES }}
        filterSummary={leaseExportFilterSummary}
        matchedRowCount={meta?.totalCount}
        onOpenChange={setExportTableOpen}
        open={exportTableOpen}
        propertyId={propertyId}
      />
    </>
  );
});
PropertyLeasesPage.displayName = "PropertyLeasesPage";
