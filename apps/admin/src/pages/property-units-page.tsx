import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { DeletedBadge, deletedRowClassName, RestoreEntityButton } from "@/components/deleted-badge";
import { StartLeaseDialog } from "@/components/leases/start-lease-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateUnitDialog } from "@/components/units/create-unit-dialog";
import { EditUnitDialog } from "@/components/units/edit-unit-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { usePropertyActiveLeases } from "@/hooks/use-property-active-leases";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { unitsApi } from "@/lib/api-client";
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import { sortUnits } from "@/lib/unit-sort";
import {
  getLeaseOccupancyNames,
  type IPropertyLongStay,
  type IPropertyUnit,
  TUnitRentalType,
} from "@/packages/shared";
import { formatUnitRentalTypeLabel, UnitRentalType } from "@/packages/shared";

const RentalTypeBadge = memo(({ type }: { type: TUnitRentalType }) => {
  const isShort = type === UnitRentalType.SHORT_TERM;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isShort
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      }`}
    >
      {formatUnitRentalTypeLabel(type)}
    </span>
  );
});
RentalTypeBadge.displayName = "RentalTypeBadge";

const UnitRow = memo(
  ({
    activeLease,
    canManage,
    onDelete,
    onEdit,
    onRestore,
    onStartLease,
    unit,
  }: {
    activeLease?: IPropertyLongStay;
    canManage: boolean;
    onStartLease: (unit: IPropertyUnit) => void;
    onDelete: (unit: IPropertyUnit) => void;
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
          {isLongTerm && !unit.isDeleted ? (
            isVacant ? (
              <Badge variant="outline">Vacant</Badge>
            ) : (
              <div className="flex flex-wrap gap-1">
                {occupancyNames.map((name, index) => (
                  <Badge key={`${name}-${index}`} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            )
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
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
                  <Button
                    aria-label="Delete unit"
                    onClick={() => onDelete(unit)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
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

export const PropertyUnitsPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageUnits;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<IPropertyUnit | null>(null);
  const [startLeaseUnit, setStartLeaseUnit] = useState<IPropertyUnit | null>(null);
  const { getColumnAriaSort, getColumnDirection, sortState, toggleSort } = useUrlTableSort({
    defaultColumnId: "type",
    defaultDirection: "asc",
  });

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

  const { deleteConfirmationDialog, requestDelete } = useDeleteConfirmation<IPropertyUnit>(
    deleteMutation.isPending,
    (unit, onDeleted) => deleteMutation.mutate(unit, { onSuccess: onDeleted })
  );

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

  const handleDelete = useCallback(
    (unit: IPropertyUnit) => {
      requestDelete({
        description: `Delete unit ${unit.unitNumber}? It will be hidden from lists. Platform admins can restore it.`,
        target: unit,
        title: "Delete unit",
      });
    },
    [requestDelete]
  );

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);

  const sortedUnits = useMemo(() => sortUnits(units, sortState), [sortState, units]);

  const handleOpenCreateUnit = useCallback(() => {
    setCreateOpen(true);
  }, []);

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
          {unitsQuery.isPending ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Layout</TableHead>
                  <SortableTableHead
                    ariaSort={getColumnAriaSort("type")}
                    direction={getColumnDirection("type")}
                    label="Type"
                    onSort={() => toggleSort("type")}
                  />
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Added</TableHead>
                  {canManage ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUnits.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={canManage ? 6 : 5}>
                      No units yet.{canManage ? " Add a unit to get started." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedUnits.map((unit) => (
                    <UnitRow
                      activeLease={activeLeaseByUnitId.get(unit.id)}
                      canManage={canManage}
                      key={unit.id}
                      onDelete={handleDelete}
                      onEdit={setEditUnit}
                      onRestore={(item) => restoreMutation.mutate(item)}
                      onStartLease={setStartLeaseUnit}
                      unit={unit}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {deleteConfirmationDialog}

      <CreateUnitDialog onOpenChange={setCreateOpen} open={createOpen} propertyId={propertyId} />
      {editUnit ? (
        <EditUnitDialog
          key={editUnit.id}
          onOpenChange={(open) => {
            if (!open) setEditUnit(null);
          }}
          open={true}
          propertyId={propertyId}
          unit={editUnit}
        />
      ) : null}
      {startLeaseUnit ? (
        <StartLeaseDialog
          key={startLeaseUnit.id}
          onOpenChange={(open) => {
            if (!open) setStartLeaseUnit(null);
          }}
          open={true}
          propertyId={propertyId}
          unit={startLeaseUnit}
          units={units}
        />
      ) : null}
    </>
  );
});
PropertyUnitsPage.displayName = "PropertyUnitsPage";
