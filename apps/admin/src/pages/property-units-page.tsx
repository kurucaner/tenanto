import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { usePropertyShell } from "@/components/properties/property-shell-context";
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
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { unitsApi } from "@/lib/api-client";
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IPropertyUnit } from "@/packages/shared";
import { UnitRentalType } from "@/packages/shared";

const RentalTypeBadge = memo(({ type }: { type: string }) => {
  const isShort = type === UnitRentalType.SHORT_TERM;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isShort
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      }`}
    >
      {isShort ? "Short Term" : "Long Term"}
    </span>
  );
});
RentalTypeBadge.displayName = "RentalTypeBadge";

const UnitRow = memo(
  ({
    canManage,
    onDelete,
    onEdit,
    unit,
  }: {
    canManage: boolean;
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
  const canManage = permissions.canManageStructure;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<IPropertyUnit | null>(null);

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: adminQueryKeys.propertyUnits(propertyId),
  });

  const deleteMutation = useMutation({
    mutationFn: (unit: IPropertyUnit) => unitsApi.delete(propertyId, unit.id),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete unit");
    },
    onSuccess: () => {
      toast.success("Unit deleted");
      invalidatePropertyUnitCaches(queryClient, propertyId);
    },
  });

  const handleDelete = (unit: IPropertyUnit) => {
    if (!globalThis.confirm(`Delete unit ${unit.unitNumber}? This cannot be undone.`)) return;
    deleteMutation.mutate(unit);
  };

  const units = unitsQuery.data?.units ?? [];

  usePropertyShellActions(
    canManage ? (
      <Button className="gap-1.5" onClick={() => setCreateOpen(true)} size="sm" type="button">
        <Plus className="size-3.5" />
        Add Unit
      </Button>
    ) : null
  );

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
                  <TableHead>Unit</TableHead>
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
                      No units yet.{canManage ? " Add one to get started." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit) => (
                    <UnitRow
                      canManage={canManage}
                      key={unit.id}
                      onDelete={handleDelete}
                      onEdit={(u) => setEditUnit(u)}
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
    </>
  );
});
PropertyUnitsPage.displayName = "PropertyUnitsPage";
