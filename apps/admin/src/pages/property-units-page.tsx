import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { CreateLongStayDialog } from "@/components/long-stays/create-long-stay-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { unitsApi } from "@/lib/api-client";
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IPropertyUnit, TUnitRentalType } from "@/packages/shared";
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
    canManage,
    onAddLongStay,
    onDelete,
    onEdit,
    unit,
  }: {
    canManage: boolean;
    onAddLongStay: (unit: IPropertyUnit) => void;
    onDelete: (unit: IPropertyUnit) => void;
    onEdit: (unit: IPropertyUnit) => void;
    unit: IPropertyUnit;
  }) => (
    <TableRow>
      <TableCell className="font-medium">{unit.unitNumber}</TableCell>
      <TableCell>{unit.layout}</TableCell>
      <TableCell>
        <RentalTypeBadge type={unit.rentalType} />
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(unit.createdAt).toLocaleDateString()}
      </TableCell>
      {canManage ? (
        <TableCell>
          <div className="flex items-center gap-1">
            {unit.rentalType === UnitRentalType.LONG_TERM ? (
              <Button
                aria-label="Add long stay"
                onClick={() => onAddLongStay(unit)}
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
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  )
);
UnitRow.displayName = "UnitRow";

export const PropertyUnitsPage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageUnits;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<IPropertyUnit | null>(null);
  const [longStayUnit, setLongStayUnit] = useState<IPropertyUnit | null>(null);

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: adminQueryKeys.propertyUnits(propertyId),
  });

  const deleteMutation = useMutation({
    mutationFn: (unit: IPropertyUnit) => unitsApi.delete(propertyId, unit.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    },
    onSuccess: () => {
      toast.success("Deleted");
      invalidatePropertyUnitCaches(queryClient, propertyId);
    },
  });

  const handleDelete = (unit: IPropertyUnit) => {
    if (!globalThis.confirm(`Delete unit ${unit.unitNumber}? This cannot be undone.`)) return;
    deleteMutation.mutate(unit);
  };

  const units = unitsQuery.data?.units ?? [];

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
                  <TableHead>Type</TableHead>
                  <TableHead>Added</TableHead>
                  {canManage ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={canManage ? 5 : 4}>
                      No units yet.{canManage ? " Add a unit to get started." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit) => (
                    <UnitRow
                      canManage={canManage}
                      key={unit.id}
                      onAddLongStay={setLongStayUnit}
                      onDelete={handleDelete}
                      onEdit={setEditUnit}
                      unit={unit}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
      {longStayUnit ? (
        <CreateLongStayDialog
          key={longStayUnit.id}
          onOpenChange={(open) => {
            if (!open) setLongStayUnit(null);
          }}
          open={true}
          propertyId={propertyId}
          unit={longStayUnit}
        />
      ) : null}
    </>
  );
});
PropertyUnitsPage.displayName = "PropertyUnitsPage";
