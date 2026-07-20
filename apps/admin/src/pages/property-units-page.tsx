import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Pencil, Plus } from "lucide-react";
import {
  memo,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableCountFooter } from "@/components/data-table/data-table-count-footer";
import {
  type DataTableColumn,
  type DataTableSortController,
} from "@/components/data-table/data-table-types";
import { DeletedBadge, RestoreEntityButton } from "@/components/deleted-badge";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { TableIconButton } from "@/components/table/table-icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { CreateUnitDialog } from "@/components/units/create-unit-dialog";
import { EditUnitDialog } from "@/components/units/edit-unit-dialog";
import { PropertyUnitToolbar } from "@/components/units/property-unit-toolbar";
import { type TUnitFilterKey } from "@/components/units/unit-filter-panel";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import { usePropertyActiveLeases } from "@/hooks/use-property-active-leases";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { usePropertyUnitsInfiniteList } from "@/hooks/use-property-units-infinite-list";
import { useQuickDelete } from "@/hooks/use-quick-delete";
import { useUrlDateRangeFilter } from "@/hooks/use-url-date-range-filter";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { unitsApi } from "@/lib/api-client";
import { getDateRangeSummary } from "@/lib/date-range-presets";
import { getFilteredTableFetchState } from "@/lib/filtered-table-fetch-state";
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { deletedRowClassName } from "@/lib/ledger-entry-row-styles";
import { getDefaultReportDateRange } from "@/lib/report-date-defaults";
import { buildPropertyStartLeasePath } from "@/lib/start-lease-routes";
import { getUnitRentalTypeBadgeClassName } from "@/lib/unit-rental-type-styles";
import {
  buildUnitToolbarClearAllPatch,
  buildUnitToolbarClearOnePatch,
  buildUnitToolbarFilterItems,
  countUnitSecondaryFilters,
  type TUnitToolbarFilterId,
} from "@/lib/unit-toolbar-filters";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  getLeaseOccupancyNames,
  type IPropertyLongStay,
  type IPropertyUnit,
  type IPropertyUnitsListMeta,
  type TPropertyUnitsListFilters,
  type TUnitOccupancyFilter,
  type TUnitRentalType,
  UnitOccupancyFilter,
  UnitRentalType,
} from "@/packages/shared";
import { formatUnitRentalTypeLabel } from "@/packages/shared";

const RentalTypeBadge = memo(({ type }: { type: TUnitRentalType }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getUnitRentalTypeBadgeClassName(type)}`}
  >
    {formatUnitRentalTypeLabel(type)}
  </span>
));
RentalTypeBadge.displayName = "RentalTypeBadge";

const UnitRow = memo(
  ({
    activeLease,
    canManage,
    isDeletePending,
    isQuickDeleteActive,
    onDelete,
    onEdit,
    onRestore,
    onStartLease,
    unit,
  }: {
    activeLease?: IPropertyLongStay;
    canManage: boolean;
    isDeletePending: boolean;
    isQuickDeleteActive: boolean;
    onStartLease: (unit: IPropertyUnit) => void;
    onDelete: (unit: IPropertyUnit, event?: MouseEvent<HTMLButtonElement>) => void;
    onEdit: (unit: IPropertyUnit) => void;
    onRestore: (unit: IPropertyUnit) => void;
    unit: IPropertyUnit;
  }) => {
    const isLongTerm = unit.rentalType === UnitRentalType.LONG_TERM;
    const isVacant = isLongTerm && !activeLease;
    const occupancyNames = activeLease ? getLeaseOccupancyNames(activeLease) : [];

    return (
      <TableRow className={unit.isDeleted ? deletedRowClassName : undefined}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {unit.unitNumber}
            {unit.isDeleted ? <DeletedBadge /> : null}
          </div>
        </TableCell>
        <TableCell>{unit.layout}</TableCell>
        <TableCell>
          <RentalTypeBadge type={unit.rentalType} />
        </TableCell>
        <TableCell>
          {(() => {
            if (!isLongTerm || unit.isDeleted) {
              return <span className="text-muted-foreground text-xs">—</span>;
            }
            if (isVacant) {
              return <Badge variant="outline">Vacant</Badge>;
            }
            return (
              <div className="flex flex-wrap gap-1">
                {occupancyNames.map((name, index) => (
                  <Badge key={`${name}-${index}`} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            );
          })()}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {new Date(unit.createdAt).toLocaleDateString()}
        </TableCell>
        {canManage ? (
          <TableCell>
            <div className="flex items-center gap-1">
              {unit.isDeleted ? (
                <RestoreEntityButton ariaLabel="Restore unit" onClick={() => onRestore(unit)} />
              ) : (
                <>
                  {isLongTerm && isVacant ? (
                    <TableIconButton
                      ariaLabel="Start lease"
                      onClick={() => onStartLease(unit)}
                      tooltip="Start lease"
                    >
                      <CirclePlus className="size-3.5" />
                    </TableIconButton>
                  ) : null}
                  <TableIconButton
                    ariaLabel="Edit unit"
                    onClick={() => onEdit(unit)}
                    tooltip="Edit unit"
                  >
                    <Pencil className="size-3.5" />
                  </TableIconButton>
                  <QuickDeleteButton
                    ariaLabel="Delete unit"
                    disabled={isDeletePending}
                    onClick={(event) => onDelete(unit, event)}
                    quickDeleteActive={isQuickDeleteActive}
                  />
                </>
              )}
            </div>
          </TableCell>
        ) : null}
      </TableRow>
    );
  }
);
UnitRow.displayName = "UnitRow";

const UNIT_ROW_ESTIMATED_HEIGHT = 44;

const UNIT_RENTAL_TYPE_FILTER_OPTIONS = [
  { label: formatUnitRentalTypeLabel(UnitRentalType.SHORT_TERM), value: UnitRentalType.SHORT_TERM },
  { label: formatUnitRentalTypeLabel(UnitRentalType.LONG_TERM), value: UnitRentalType.LONG_TERM },
] as const;

const UNIT_OCCUPANCY_FILTER_OPTIONS = [
  { label: "Vacant", value: UnitOccupancyFilter.VACANT },
  { label: "Occupied", value: UnitOccupancyFilter.OCCUPIED },
] as const;

function buildUnitListFilters(
  effectiveFrom: string,
  effectiveTo: string,
  occupancy: string,
  q: string,
  rentalType: string,
  sortBy?: TPropertyUnitsListFilters["sortBy"],
  sortDir?: TPropertyUnitsListFilters["sortDir"]
): TPropertyUnitsListFilters {
  const next: TPropertyUnitsListFilters = {};
  if (effectiveFrom) next.from = effectiveFrom;
  if (effectiveTo) next.to = effectiveTo;
  if (rentalType) next.rentalType = rentalType as TUnitRentalType;
  if (occupancy) next.occupancy = occupancy as TUnitOccupancyFilter;
  const qTrim = q.trim();
  if (qTrim) next.q = qTrim;
  if (sortBy) next.sortBy = sortBy;
  if (sortDir) next.sortDir = sortDir;
  return next;
}

function getUnitKey(unit: IPropertyUnit): string {
  return unit.id;
}

function getUnitColumns(canManage: boolean): DataTableColumn[] {
  return [
    { id: "name", label: "Name" },
    { id: "layout", label: "Layout" },
    { id: "type", label: "Type", sortable: true },
    { id: "occupancy", label: "Occupancy" },
    { id: "added", label: "Added" },
    { hidden: !canManage, id: "actions", label: "Actions" },
  ];
}

function buildUnitsFooterItems(meta: IPropertyUnitsListMeta) {
  return [
    { label: "Total", value: String(meta.totalCount) },
    { label: "Short Term", value: String(meta.shortTermCount) },
    { label: "Long Term", value: String(meta.longTermCount) },
  ];
}

const PropertyUnitsTable = memo(
  ({
    activeLeaseByUnitId,
    canManage,
    emptyMessage,
    hasNextPage,
    infiniteScrollSentinelRef,
    isDeletePending,
    isFetchingNextPage,
    isPending,
    isQuickDeleteActive,
    isRefreshing,
    listMeta,
    onDelete,
    onEdit,
    onRestore,
    onStartLease,
    sort,
    toolbar,
    units,
  }: {
    activeLeaseByUnitId: Map<string, IPropertyLongStay>;
    canManage: boolean;
    emptyMessage: string;
    hasNextPage: boolean;
    infiniteScrollSentinelRef: RefObject<HTMLDivElement | null>;
    isDeletePending: boolean;
    isFetchingNextPage: boolean;
    isPending: boolean;
    isQuickDeleteActive: boolean;
    isRefreshing: boolean;
    listMeta?: IPropertyUnitsListMeta;
    onDelete: (unit: IPropertyUnit, event?: MouseEvent<HTMLButtonElement>) => void;
    onEdit: (unit: IPropertyUnit) => void;
    onRestore: (unit: IPropertyUnit) => void;
    onStartLease: (unit: IPropertyUnit) => void;
    sort: DataTableSortController;
    toolbar: ReactNode;
    units: IPropertyUnit[];
  }) => {
    const renderUnitRow = useCallback(
      (unit: IPropertyUnit) => (
        <UnitRow
          activeLease={activeLeaseByUnitId.get(unit.id)}
          canManage={canManage}
          isDeletePending={isDeletePending}
          isQuickDeleteActive={isQuickDeleteActive}
          key={unit.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onRestore={onRestore}
          onStartLease={onStartLease}
          unit={unit}
        />
      ),
      [
        activeLeaseByUnitId,
        canManage,
        isDeletePending,
        isQuickDeleteActive,
        onDelete,
        onEdit,
        onRestore,
        onStartLease,
      ]
    );

    const columns = useMemo(() => getUnitColumns(canManage), [canManage]);
    const colSpan = columns.filter((column) => !column.hidden).length;

    return (
      <DataTable
        columns={columns}
        emptyMessage={emptyMessage}
        footer={
          listMeta ? (
            <DataTableCountFooter colSpan={colSpan} items={buildUnitsFooterItems(listMeta)} />
          ) : undefined
        }
        getItemKey={getUnitKey}
        infiniteScroll={{ hasNextPage, isFetchingNextPage }}
        infiniteScrollSentinelRef={infiniteScrollSentinelRef}
        isPending={isPending}
        isRefreshing={isRefreshing}
        items={units}
        renderRow={renderUnitRow}
        sort={sort}
        toolbar={toolbar}
        virtualization={{ estimateRowHeight: UNIT_ROW_ESTIMATED_HEIGHT }}
      />
    );
  }
);
PropertyUnitsTable.displayName = "PropertyUnitsTable";

function handleUnitDialogOpenChange(open: boolean, clearSelection: () => void): void {
  if (!open) {
    clearSelection();
  }
}

const PropertyUnitsPageDialogs = memo(
  ({
    createOpen,
    editUnit,
    onCreateOpenChange,
    onEditOpenChange,
    propertyId,
  }: {
    createOpen: boolean;
    editUnit: IPropertyUnit | null;
    onCreateOpenChange: (open: boolean) => void;
    onEditOpenChange: (open: boolean) => void;
    propertyId: string;
  }) => (
    <>
      <CreateUnitDialog
        onOpenChange={onCreateOpenChange}
        open={createOpen}
        propertyId={propertyId}
      />
      {editUnit ? (
        <EditUnitDialog
          key={editUnit.id}
          onOpenChange={onEditOpenChange}
          open={true}
          propertyId={propertyId}
          unit={editUnit}
        />
      ) : null}
    </>
  )
);
PropertyUnitsPageDialogs.displayName = "PropertyUnitsPageDialogs";

export const PropertyUnitsPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageUnits;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<IPropertyUnit | null>(null);

  const defaultDateRange = useMemo(() => getDefaultReportDateRange(), []);
  const unitFilterSchema = useMemo(
    () =>
      defineUrlFilterSchema<{
        allTime: string;
        from: string;
        occupancy: string;
        q: string;
        rentalType: string;
        to: string;
      }>({
        allTime: { defaultValue: "true" },
        from: { defaultValue: defaultDateRange.from },
        occupancy: { defaultValue: "" },
        q: { defaultValue: "" },
        rentalType: { defaultValue: "" },
        to: { defaultValue: defaultDateRange.to },
      }),
    [defaultDateRange.from, defaultDateRange.to]
  );

  const { filters, setFilter, setFilters } = useUrlFilterState(unitFilterSchema);
  const { allTime: allTimeParam, from, occupancy, q, rentalType, to } = filters;
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
    dateFilterSchema: unitFilterSchema,
    from,
    to,
  });
  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );

  const sortController = useUrlTableSort({
    defaultColumnId: "type",
    defaultDirection: "asc",
  });
  const { sortState } = sortController;

  const listQueryFilters = useMemo(
    () =>
      buildUnitListFilters(
        effectiveFrom,
        effectiveTo,
        occupancy,
        q,
        rentalType,
        sortState.columnId === "type" ? "type" : undefined,
        sortState.columnId === "type" ? sortState.direction : undefined
      ),
    [effectiveFrom, effectiveTo, occupancy, q, rentalType, sortState.columnId, sortState.direction]
  );

  const {
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
    meta: listMeta,
    units,
  } = usePropertyUnitsInfiniteList(propertyId, listQueryFilters);

  const { isFilterRefetching, isTableInitialPending } = getFilteredTableFetchState({
    isFetching,
    isFetchingNextPage,
    isPending,
    itemCount: units.length,
  });

  const activeSecondaryFilterCount = useMemo(
    () => countUnitSecondaryFilters({ occupancy, rentalType }),
    [occupancy, rentalType]
  );

  const dateSummary = useMemo(
    () => getDateRangeSummary(activePreset, displayFrom, displayTo),
    [activePreset, displayFrom, displayTo]
  );

  const hasActiveFilters = useMemo(
    () => Boolean(q.trim() || rentalType || occupancy || !allTime),
    [allTime, occupancy, q, rentalType]
  );

  const emptyMessage = useMemo(() => {
    if (hasActiveFilters) {
      return "No units match these filters.";
    }
    return `No units yet.${canManage ? " Add a unit to get started." : ""}`;
  }, [canManage, hasActiveFilters]);

  const activeFilterItems = useMemo(
    () =>
      buildUnitToolbarFilterItems({
        activePreset,
        allTime,
        dateSummary,
        occupancy,
        occupancyOptions: UNIT_OCCUPANCY_FILTER_OPTIONS,
        q,
        rentalType,
        rentalTypeOptions: UNIT_RENTAL_TYPE_FILTER_OPTIONS,
      }),
    [activePreset, allTime, dateSummary, occupancy, q, rentalType]
  );

  const handleUnitFilterChange = useCallback(
    (key: TUnitFilterKey, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  const handleClearSecondaryFilters = useCallback(() => {
    setFilters({ occupancy: "", rentalType: "" });
  }, [setFilters]);

  const handleRemoveToolbarFilter = useCallback(
    (id: TUnitToolbarFilterId) => {
      if (id === "q") {
        handleSearchInputChange("");
        return;
      }
      setFilters(buildUnitToolbarClearOnePatch(id, defaultDateRange));
    },
    [defaultDateRange, handleSearchInputChange, setFilters]
  );

  const handleClearAllToolbarFilters = useCallback(() => {
    handleSearchInputChange("");
    setFilters(buildUnitToolbarClearAllPatch(defaultDateRange));
  }, [defaultDateRange, handleSearchInputChange, setFilters]);

  const scrollSentinelRef = useInfiniteScrollTrigger({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  const { activeLeases } = usePropertyActiveLeases(propertyId);

  const activeLeaseByUnitId = useMemo(() => {
    const map = new Map<string, IPropertyLongStay>();
    for (const lease of activeLeases) {
      map.set(lease.unitId, lease);
    }
    return map;
  }, [activeLeases]);

  const deleteMutation = useMutation({
    mutationFn: (unit: IPropertyUnit) => unitsApi.delete(propertyId, unit.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    },
    onSuccess: () => {
      toast.success("Unit deleted");
      invalidatePropertyUnitCaches(queryClient, propertyId);
    },
  });

  const { deleteConfirmationDialog, handleDelete, isQuickDeleteActive } =
    useQuickDelete<IPropertyUnit>({
      deleteFn: (unit, onDeleted) => deleteMutation.mutate(unit, { onSuccess: onDeleted }),
      getConfirmationOptions: (unit) => ({
        description: `Delete unit ${unit.unitNumber}? It will be hidden from lists. Platform admins can restore it.`,
        target: unit,
        title: "Delete unit",
      }),
      isPending: deleteMutation.isPending,
    });

  const restoreMutation = useMutation({
    mutationFn: (unit: IPropertyUnit) => unitsApi.restore(propertyId, unit.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to restore unit");
    },
    onSuccess: () => {
      toast.success("Unit restored");
      invalidatePropertyUnitCaches(queryClient, propertyId);
    },
  });

  const handleOpenCreateUnit = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleRestoreUnit = useCallback(
    (unit: IPropertyUnit) => {
      restoreMutation.mutate(unit);
    },
    [restoreMutation]
  );

  const handleStartLease = useCallback(
    (unit: IPropertyUnit) => {
      navigate(buildPropertyStartLeasePath(propertyId, { from: "units", unitId: unit.id }));
    },
    [navigate, propertyId]
  );

  const pageActions = useMemo(
    () =>
      canManage ? (
        <Button className="gap-1.5" onClick={handleOpenCreateUnit} size="sm" type="button">
          <Plus className="size-3.5" />
          Add Unit
        </Button>
      ) : null,
    [canManage, handleOpenCreateUnit]
  );

  usePropertyShellActions(pageActions);

  return (
    <>
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <PropertyUnitsTable
            activeLeaseByUnitId={activeLeaseByUnitId}
            canManage={canManage}
            emptyMessage={emptyMessage}
            hasNextPage={hasNextPage}
            infiniteScrollSentinelRef={scrollSentinelRef}
            isDeletePending={deleteMutation.isPending}
            isFetchingNextPage={isFetchingNextPage}
            isPending={isTableInitialPending}
            isQuickDeleteActive={isQuickDeleteActive}
            isRefreshing={isFilterRefetching}
            listMeta={listMeta}
            onDelete={handleDelete}
            onEdit={setEditUnit}
            onRestore={handleRestoreUnit}
            onStartLease={handleStartLease}
            sort={sortController}
            toolbar={
              <PropertyUnitToolbar
                activeFilterCount={activeSecondaryFilterCount}
                activeFilterItems={activeFilterItems}
                activePreset={activePreset}
                countLabel={listMeta ? `${listMeta.totalCount} units` : undefined}
                from={displayFrom}
                occupancy={occupancy}
                occupancyOptions={UNIT_OCCUPANCY_FILTER_OPTIONS}
                onClearAll={handleClearAllToolbarFilters}
                onClearSecondaryFilters={handleClearSecondaryFilters}
                onFilterChange={handleUnitFilterChange}
                onFromChange={onFromChange}
                onPresetChange={onPresetChange}
                onRemoveFilter={handleRemoveToolbarFilter}
                onSearchInputChange={handleSearchInputChange}
                onToChange={onToChange}
                rentalType={rentalType}
                rentalTypeOptions={UNIT_RENTAL_TYPE_FILTER_OPTIONS}
                searchInput={searchInput}
                to={displayTo}
              />
            }
            units={units}
          />
        </CardContent>
      </Card>

      {deleteConfirmationDialog}

      <PropertyUnitsPageDialogs
        createOpen={createOpen}
        editUnit={editUnit}
        onCreateOpenChange={setCreateOpen}
        onEditOpenChange={(open) => handleUnitDialogOpenChange(open, () => setEditUnit(null))}
        propertyId={propertyId}
      />
    </>
  );
});
PropertyUnitsPage.displayName = "PropertyUnitsPage";
