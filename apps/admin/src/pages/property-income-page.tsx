import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { CreateReservationDialog } from "@/components/income/create-reservation-dialog";
import { EditReservationDialog } from "@/components/income/edit-reservation-dialog";
import {
  CHANNEL_OPTIONS,
  formatChannelLabel,
  formatStatusLabel,
  reservationSelectClassName,
  STATUS_OPTIONS,
} from "@/components/income/reservation-form-options";
import { PropertyPageShell } from "@/components/properties/property-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { propertiesApi, reservationsApi, unitsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyReservationCaches } from "@/lib/invalidate-property-reservation-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IPropertyReservation, IPropertyReservationsListQuery } from "@/packages/shared";
import { PropertyRole, UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const ReservationRow = memo(
  ({
    canManage,
    onDelete,
    onEdit,
    reservation,
    unitLabel,
  }: {
    canManage: boolean;
    onDelete: (reservation: IPropertyReservation) => void;
    onEdit: (reservation: IPropertyReservation) => void;
    reservation: IPropertyReservation;
    unitLabel: string;
  }) => (
    <TableRow>
      <TableCell className="font-medium">{unitLabel}</TableCell>
      <TableCell>{reservation.guestName}</TableCell>
      <TableCell>{reservation.checkIn}</TableCell>
      <TableCell>{reservation.checkOut}</TableCell>
      <TableCell>{reservation.nights}</TableCell>
      <TableCell>{formatChannelLabel(reservation.channel)}</TableCell>
      <TableCell>{formatStatusLabel(reservation.status)}</TableCell>
      <TableCell className="text-right">{formatMoney(reservation.roomRate)}</TableCell>
      <TableCell className="text-right">{formatMoney(reservation.cleaningFee)}</TableCell>
      <TableCell className="text-right">{formatMoney(reservation.grossIncome)}</TableCell>
      <TableCell className="text-right font-medium">{formatMoney(reservation.netIncome)}</TableCell>
      {canManage ? (
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Edit income entry"
              onClick={() => onEdit(reservation)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              aria-label="Delete income entry"
              onClick={() => onDelete(reservation)}
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
ReservationRow.displayName = "ReservationRow";

const PropertyIncomeContent = memo(
  ({ propertyId, propertyName }: { propertyId: string; propertyName: string }) => {
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((s) => s.user);
    const [createOpen, setCreateOpen] = useState(false);
    const [editReservation, setEditReservation] = useState<IPropertyReservation | null>(null);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [unitId, setUnitId] = useState("");
    const [channel, setChannel] = useState("");
    const [status, setStatus] = useState("");

    const filters = useMemo<IPropertyReservationsListQuery>(() => {
      const next: IPropertyReservationsListQuery = {};
      if (from) next.from = from;
      if (to) next.to = to;
      if (unitId) next.unitId = unitId;
      if (channel) next.channel = channel as IPropertyReservationsListQuery["channel"];
      if (status) next.status = status as IPropertyReservationsListQuery["status"];
      return next;
    }, [channel, from, status, to, unitId]);

    const reservationsQuery = useQuery({
      queryFn: () => reservationsApi.list(propertyId, filters),
      queryKey: adminQueryKeys.propertyReservations(propertyId, filters),
    });

    const unitsQuery = useQuery({
      queryFn: () => unitsApi.list(propertyId),
      queryKey: adminQueryKeys.propertyUnits(propertyId),
    });

    const propertyDetailQuery = useQuery({
      queryFn: () => propertiesApi.getDetail(propertyId),
      queryKey: adminQueryKeys.propertyDetail(propertyId),
    });

    const isAdmin = currentUser?.userType === UserType.ADMIN;
    const members = propertyDetailQuery.data?.property?.members ?? [];
    const callerMembership = members.find((m) => m.userId === currentUser?.id);
    const isCreator = propertyDetailQuery.data?.property?.createdBy === currentUser?.id;
    const canManage = isAdmin || isCreator || callerMembership?.role === PropertyRole.OWNER;

    const units = unitsQuery.data?.units ?? [];
    const unitLabelById = useMemo(
      () => new Map(units.map((unit) => [unit.id, unit.unitNumber])),
      [units]
    );

    const deleteMutation = useMutation({
      mutationFn: (reservation: IPropertyReservation) =>
        reservationsApi.delete(propertyId, reservation.id),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to delete income entry");
      },
      onSuccess: () => {
        toast.success("Income entry deleted");
        invalidatePropertyReservationCaches(queryClient, propertyId);
      },
    });

    const handleDelete = (reservation: IPropertyReservation) => {
      if (
        !globalThis.confirm(
          `Delete income entry for ${reservation.guestName}? This cannot be undone.`
        )
      ) {
        return;
      }
      deleteMutation.mutate(reservation);
    };

    const reservations = reservationsQuery.data?.reservations ?? [];

    const actions = canManage ? (
      <Button className="gap-1.5" onClick={() => setCreateOpen(true)} size="sm" type="button">
        <Plus className="size-3.5" />
        Add Income
      </Button>
    ) : undefined;

    return (
      <PropertyPageShell actions={actions} propertyId={propertyId} propertyName={propertyName}>
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="filter-from">From</Label>
                <Input
                  id="filter-from"
                  onChange={(e) => setFrom(e.target.value)}
                  type="date"
                  value={from}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-to">To</Label>
                <Input
                  id="filter-to"
                  onChange={(e) => setTo(e.target.value)}
                  type="date"
                  value={to}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-unit">Unit</Label>
                <select
                  className={reservationSelectClassName}
                  id="filter-unit"
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
                <Label htmlFor="filter-channel">Channel</Label>
                <select
                  className={reservationSelectClassName}
                  id="filter-channel"
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
                <Label htmlFor="filter-status">Status</Label>
                <select
                  className={reservationSelectClassName}
                  id="filter-status"
                  onChange={(e) => setStatus(e.target.value)}
                  value={status}
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {reservationsQuery.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Nights</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Room</TableHead>
                      <TableHead className="text-right">Cleaning</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      {canManage ? <TableHead>Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          className="text-muted-foreground"
                          colSpan={canManage ? 12 : 11}
                        >
                          No income entries yet.{canManage ? " Add one to get started." : ""}
                        </TableCell>
                      </TableRow>
                    ) : (
                      reservations.map((reservation) => (
                        <ReservationRow
                          canManage={canManage}
                          key={reservation.id}
                          onDelete={handleDelete}
                          onEdit={setEditReservation}
                          reservation={reservation}
                          unitLabel={unitLabelById.get(reservation.unitId) ?? "—"}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <CreateReservationDialog
          onOpenChange={setCreateOpen}
          open={createOpen}
          propertyId={propertyId}
        />
        {editReservation ? (
          <EditReservationDialog
            key={editReservation.id}
            onOpenChange={(open) => {
              if (!open) setEditReservation(null);
            }}
            open={true}
            propertyId={propertyId}
            reservation={editReservation}
            units={units}
          />
        ) : null}
      </PropertyPageShell>
    );
  }
);
PropertyIncomeContent.displayName = "PropertyIncomeContent";

const PropertyIncomePageInner = memo(() => {
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
    <PropertyIncomeContent
      key={propertyId}
      propertyId={propertyId}
      propertyName={propertyQuery.data.property.name}
    />
  );
});
PropertyIncomePageInner.displayName = "PropertyIncomePageInner";

export const PropertyIncomePage = PropertyIncomePageInner;
