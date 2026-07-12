import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Pencil, Plus } from "lucide-react";
import { memo, type MouseEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableCountFooter } from "@/components/data-table/data-table-count-footer";
import {
  type DataTableColumn,
  type DataTableSortController,
} from "@/components/data-table/data-table-types";
import { DeletedBadge, deletedRowClassName, RestoreEntityButton } from "@/components/deleted-badge";
import { StartLeaseDialog } from "@/components/leases/start-lease-dialog";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { CreateUnitDialog } from "@/components/units/create-unit-dialog";
import { EditUnitDialog } from "@/components/units/edit-unit-dialog";
import { usePropertyActiveLeases } from "@/hooks/use-property-active-leases";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useQuickDelete } from "@/hooks/use-quick-delete";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { unitsApi } from "@/lib/api-client";
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import { getUnitRentalTypeBadgeClassName } from "@/lib/unit-rental-type-styles";
import { sortUnits } from "@/lib/unit-sort";
import {
  getLeaseOccupancyNames,
  type IPropertyLongStay,
  type IPropertyUnit,
  type IPropertyUnitsListMeta,
  TUnitRentalType,
} from "@/packages/shared";
import { formatUnitRentalTypeLabel, UnitRentalType } from "@/packages/shared";

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
                    <Button
                      aria-label="Start lease"
                      onClick={() => onStartLease(unit)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <CirclePlus className="size-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    aria-label="Edit unit"
                    onClick={() => onEdit(unit)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
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
    isDeletePending,
    isPending,
    isQuickDeleteActive,
    listMeta,
    onDelete,
    onEdit,
    onRestore,
    onStartLease,
    sort,
    sortedUnits,
  }: {
    activeLeaseByUnitId: Map<string, IPropertyLongStay>;
    canManage: boolean;
    isDeletePending: boolean;
    isPending: boolean;
    isQuickDeleteActive: boolean;
    listMeta?: IPropertyUnitsListMeta;
    onDelete: (unit: IPropertyUnit, event?: MouseEvent<HTMLButtonElement>) => void;
    onEdit: (unit: IPropertyUnit) => void;
    onRestore: (unit: IPropertyUnit) => void;
    onStartLease: (unit: IPropertyUnit) => void;
    sort: DataTableSortController;
    sortedUnits: IPropertyUnit[];
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
        emptyMessage={`No units yet.${canManage ? " Add a unit to get started." : ""}`}
        footer={
          listMeta ? (
            <DataTableCountFooter colSpan={colSpan} items={buildUnitsFooterItems(listMeta)} />
          ) : undefined
        }
        getItemKey={getUnitKey}
        isPending={isPending}
        items={sortedUnits}
        renderRow={renderUnitRow}
        sort={sort}
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
    onStartLeaseOpenChange,
    propertyId,
    startLeaseUnit,
    units,
  }: {
    createOpen: boolean;
    editUnit: IPropertyUnit | null;
    onCreateOpenChange: (open: boolean) => void;
    onEditOpenChange: (open: boolean) => void;
    onStartLeaseOpenChange: (open: boolean) => void;
    propertyId: string;
    startLeaseUnit: IPropertyUnit | null;
    units: IPropertyUnit[];
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
      {startLeaseUnit ? (
        <StartLeaseDialog
          key={startLeaseUnit.id}
          onOpenChange={onStartLeaseOpenChange}
          open={true}
          propertyId={propertyId}
          unit={startLeaseUnit}
          units={units}
        />
      ) : null}
    </>
  )
);
PropertyUnitsPageDialogs.displayName = "PropertyUnitsPageDialogs";

export const PropertyUnitsPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageUnits;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<IPropertyUnit | null>(null);
  const [startLeaseUnit, setStartLeaseUnit] = useState<IPropertyUnit | null>(null);
  const sortController = useUrlTableSort({
    defaultColumnId: "type",
    defaultDirection: "asc",
  });
  const { sortState } = sortController;

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: adminQueryKeys.propertyUnits(propertyId),
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

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);
  const listMeta = unitsQuery.data?.meta;

  const sortedUnits = useMemo(() => sortUnits(units, sortState), [sortState, units]);

  const handleOpenCreateUnit = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleRestoreUnit = useCallback(
    (unit: IPropertyUnit) => {
      restoreMutation.mutate(unit);
    },
    [restoreMutation]
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
      <Card>
        <CardContent className="p-0">
          <PropertyUnitsTable
            activeLeaseByUnitId={activeLeaseByUnitId}
            canManage={canManage}
            isDeletePending={deleteMutation.isPending}
            isPending={unitsQuery.isPending}
            isQuickDeleteActive={isQuickDeleteActive}
            listMeta={listMeta}
            onDelete={handleDelete}
            onEdit={setEditUnit}
            onRestore={handleRestoreUnit}
            onStartLease={setStartLeaseUnit}
            sort={sortController}
            sortedUnits={sortedUnits}
          />
        </CardContent>
      </Card>

      {deleteConfirmationDialog}

      <PropertyUnitsPageDialogs
        createOpen={createOpen}
        editUnit={editUnit}
        onCreateOpenChange={setCreateOpen}
        onEditOpenChange={(open) => handleUnitDialogOpenChange(open, () => setEditUnit(null))}
        onStartLeaseOpenChange={(open) =>
          handleUnitDialogOpenChange(open, () => setStartLeaseUnit(null))
        }
        propertyId={propertyId}
        startLeaseUnit={startLeaseUnit}
        units={units}
      />
    </>
  );
});
PropertyUnitsPage.displayName = "PropertyUnitsPage";
