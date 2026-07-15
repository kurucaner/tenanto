import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Download, Eye, MoreHorizontal, Plus, SquarePen } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { type DataTableColumn } from "@/components/data-table/data-table-types";
import { PropertyTableExportDialog } from "@/components/exports/property-table-export-dialog";
import {
  CreateIncomeLineDialog,
  type CreateIncomeLineDialogPrefill,
} from "@/components/income/create-income-line-dialog";
import { EndLeaseDialog } from "@/components/leases/end-lease-dialog";
import { type TLeaseFilterKey } from "@/components/leases/lease-filter-panel";
import { PropertyLeaseToolbar } from "@/components/leases/property-lease-toolbar";
import { StartLeaseDialog } from "@/components/leases/start-lease-dialog";
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
import { settingsApi, unitsApi } from "@/lib/api-client";
import { getDateRangeSummary } from "@/lib/date-range-presets";
import { getFilteredTableFetchState } from "@/lib/filtered-table-fetch-state";
import { formatMoney } from "@/lib/format-money";
import { buildLeaseRecordRentPrefill } from "@/lib/lease-record-rent-prefill";
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
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  ExportResourceType,
  formatPropertyUnitSelectLabel,
  getLeaseOccupancyNames,
  type IPropertyLongStay,
  type IPropertyLongStayDetailResponse,
  PropertyLongStayStatus,
  resolveRentIncomeLineTypeId,
  type TPropertyLongStayStatus,
} from "@/packages/shared";

const LEASE_ROW_ESTIMATED_HEIGHT = 44;

const LEASE_COLUMNS: DataTableColumn[] = [
  { id: "unit", label: "Unit" },
  { id: "tenant", label: "Tenant" },
  { id: "start", label: "Start" },
  { id: "end", label: "End" },
  { align: "right", id: "rent", label: "Rent/mo" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions" },
];

function getLeaseKey(lease: IPropertyLongStay): string {
  return lease.id;
}

function buildLeaseListFilters(
  effectiveFrom: string,
  effectiveTo: string,
  q: string,
  status: string,
  unitId: string
): TPropertyLongStaysListFilters {
  const next: TPropertyLongStaysListFilters = {};
  if (effectiveFrom) next.from = effectiveFrom;
  if (effectiveTo) next.to = effectiveTo;
  if (status && status !== LEASE_STATUS_FILTER_ALL) next.status = status as TPropertyLongStayStatus;
  if (unitId) next.unitId = unitId;
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
    onRecordRent,
    unitLabel,
  }: {
    canManage: boolean;
    lease: IPropertyLongStay;
    leaseDetailPath: string;
    onEndLease: (lease: IPropertyLongStay) => void;
    onRecordRent: (lease: IPropertyLongStay) => void;
    unitLabel: string;
  }) => {
    const navigate = useNavigate();
    const endDate = lease.actualEndDate ?? lease.leaseEndDate;
    const tenantNames = getLeaseOccupancyNames(lease);

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
        <TableCell>{lease.leaseStartDate}</TableCell>
        <TableCell>{endDate}</TableCell>
        <TableCell className="text-right">{formatMoney(lease.monthlyRent)}</TableCell>
        <TableCell>
          <Badge variant={lease.status === PropertyLongStayStatus.ACTIVE ? "default" : "secondary"}>
            {lease.status === PropertyLongStayStatus.ACTIVE ? "Active" : "Ended"}
          </Badge>
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
              <>
                <TableIconButton
                  ariaLabel="Record rent"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRecordRent(lease);
                  }}
                  tooltip="Record rent"
                >
                  <CircleDollarSign className="size-3.5" />
                </TableIconButton>
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
              </>
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

  const [createOpen, setCreateOpen] = useState(false);
  const [exportTableOpen, setExportTableOpen] = useState(false);
  const [endLease, setEndLease] = useState<IPropertyLongStay | null>(null);
  const [recordRentLease, setRecordRentLease] = useState<IPropertyLongStay | null>(null);
  const [recordRentPrefill, setRecordRentPrefill] = useState<CreateIncomeLineDialogPrefill | null>(
    null
  );

  const listQueryFilters = useMemo(
    () => buildLeaseListFilters(effectiveFrom, effectiveTo, q, status, unitId),
    [effectiveFrom, effectiveTo, q, status, unitId]
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
  const incomeLineTypes = useMemo(
    () => settingsQuery.data?.settings.incomeLineTypes ?? [],
    [settingsQuery.data?.settings.incomeLineTypes]
  );
  const rentIncomeLineTypeId = useMemo(
    () => resolveRentIncomeLineTypeId(incomeLineTypes),
    [incomeLineTypes]
  );

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
    setCreateOpen(true);
  }, []);

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

  const handleRecordRent = useCallback(
    (lease: IPropertyLongStay, month?: string) => {
      const detail = queryClient.getQueryData<IPropertyLongStayDetailResponse>(
        queryKeys.propertyLongStay(propertyId, lease.id)
      );
      setRecordRentLease(lease);
      setRecordRentPrefill(
        buildLeaseRecordRentPrefill(lease, rentIncomeLineTypeId, {
          month,
          rentSchedule: detail?.rentSchedule,
        })
      );
    },
    [propertyId, queryClient, rentIncomeLineTypeId]
  );

  const renderLeaseRow = useCallback(
    (lease: IPropertyLongStay) => (
      <LeaseRow
        canManage={canManage}
        key={lease.id}
        lease={lease}
        leaseDetailPath={`/properties/${propertyId}/leases/${lease.id}`}
        onEndLease={setEndLease}
        onRecordRent={handleRecordRent}
        unitLabel={unitLabelById.get(lease.unitId) ?? lease.unitId}
      />
    ),
    [canManage, handleRecordRent, propertyId, unitLabelById]
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

      <StartLeaseDialog
        onOpenChange={setCreateOpen}
        open={createOpen}
        propertyId={propertyId}
        units={units}
      />

      {endLease ? (
        <EndLeaseDialog
          key={endLease.id}
          lease={endLease}
          onOpenChange={(open) => {
            if (!open) setEndLease(null);
          }}
          open={true}
          propertyId={propertyId}
        />
      ) : null}

      {recordRentLease ? (
        <CreateIncomeLineDialog
          incomeLineTypes={incomeLineTypes}
          key={`${recordRentLease.id}-${recordRentPrefill?.transactionDate ?? "today"}`}
          lockedLease={recordRentLease}
          onOpenChange={(open) => {
            if (!open) {
              setRecordRentLease(null);
              setRecordRentPrefill(null);
            }
          }}
          open={true}
          prefill={recordRentPrefill}
          propertyId={propertyId}
          units={units}
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
