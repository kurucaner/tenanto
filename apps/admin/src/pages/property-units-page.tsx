import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { CreateAmenityDialog } from "@/components/units/create-amenity-dialog";
import { CreateUnitDialog } from "@/components/units/create-unit-dialog";
import { EditAmenityDialog } from "@/components/units/edit-amenity-dialog";
import { EditUnitDialog } from "@/components/units/edit-unit-dialog";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { unitsApi } from "@/lib/api-client";
import { invalidatePropertyUnitCaches } from "@/lib/invalidate-property-unit-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IPropertyUnit, TUnitRentalType } from "@/packages/shared";
import {
  formatUnitKindLabel,
  formatUnitRentalTypeLabel,
  isAmenityUnit,
  isRentableUnit,
  UnitRentalType,
} from "@/packages/shared";

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

const KindBadge = memo(({ unit }: { unit: IPropertyUnit }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      isAmenityUnit(unit)
        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
        : "bg-muted text-muted-foreground"
    }`}
  >
    {formatUnitKindLabel(unit.unitKind)}
  </span>
));
KindBadge.displayName = "KindBadge";

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
      <TableCell>
        <KindBadge unit={unit} />
      </TableCell>
      <TableCell>{isRentableUnit(unit) ? unit.layout : "—"}</TableCell>
      <TableCell>
        {isRentableUnit(unit) ? <RentalTypeBadge type={unit.rentalType} /> : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(unit.createdAt).toLocaleDateString()}
      </TableCell>
      {canManage ? (
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              aria-label={isAmenityUnit(unit) ? "Edit amenity" : "Edit unit"}
              onClick={() => onEdit(unit)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              aria-label={isAmenityUnit(unit) ? "Delete amenity" : "Delete unit"}
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
  const [createAmenityOpen, setCreateAmenityOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<IPropertyUnit | null>(null);
  const [editAmenity, setEditAmenity] = useState<IPropertyUnit | null>(null);

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
    const label = isAmenityUnit(unit) ? "amenity" : "unit";
    if (!globalThis.confirm(`Delete ${label} ${unit.unitNumber}? This cannot be undone.`)) return;
    deleteMutation.mutate(unit);
  };

  const handleEdit = (unit: IPropertyUnit) => {
    if (isAmenityUnit(unit)) {
      setEditAmenity(unit);
      return;
    }
    setEditUnit(unit);
  };

  const units = unitsQuery.data?.units ?? [];

  const handleOpenCreateAmenity = useCallback(() => {
    setCreateAmenityOpen(true);
  }, []);

  const handleOpenCreateUnit = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const pageActions = useMemo(
    () =>
      canManage ? (
        <div className="flex items-center gap-2">
          <Button
            className="gap-1.5"
            onClick={handleOpenCreateAmenity}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="size-3.5" />
            Add Amenity
          </Button>
          <Button className="gap-1.5" onClick={handleOpenCreateUnit} size="sm" type="button">
            <Plus className="size-3.5" />
            Add Unit
          </Button>
        </div>
      ) : null,
    [canManage, handleOpenCreateAmenity, handleOpenCreateUnit]
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
                  <TableHead>Kind</TableHead>
                  <TableHead>Layout</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Added</TableHead>
                  {canManage ? <TableHead>Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={canManage ? 6 : 5}>
                      No units yet.{canManage ? " Add a unit or amenity to get started." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit) => (
                    <UnitRow
                      canManage={canManage}
                      key={unit.id}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
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
      <CreateAmenityDialog
        onOpenChange={setCreateAmenityOpen}
        open={createAmenityOpen}
        propertyId={propertyId}
      />
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
      {editAmenity ? (
        <EditAmenityDialog
          amenity={editAmenity}
          key={editAmenity.id}
          onOpenChange={(open) => {
            if (!open) setEditAmenity(null);
          }}
          open={true}
          propertyId={propertyId}
        />
      ) : null}
    </>
  );
});
PropertyUnitsPage.displayName = "PropertyUnitsPage";
