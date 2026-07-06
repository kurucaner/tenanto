import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

import {
  CHANNEL_OPTIONS,
  reservationSelectClassName,
  STATUS_OPTIONS,
} from "@/components/income/reservation-form-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reservationsApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyReservationCaches } from "@/lib/invalidate-property-reservation-caches";
import {
  type IPropertyReservation, type IPropertyUnit,
  type TReservationChannel,
  type TReservationStatus,
} from "@/packages/shared";

interface EditReservationDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  reservation: IPropertyReservation;
  units: IPropertyUnit[];
}

export const EditReservationDialog = memo(
  ({ onOpenChange, open, propertyId, reservation, units }: EditReservationDialogProps) => {
    const queryClient = useQueryClient();
    const [unitId, setUnitId] = useState(reservation.unitId);
    const [guestName, setGuestName] = useState(reservation.guestName);
    const [reservationNumber, setReservationNumber] = useState(
      reservation.reservationNumber ?? ""
    );
    const [checkIn, setCheckIn] = useState(reservation.checkIn);
    const [checkOut, setCheckOut] = useState(reservation.checkOut);
    const [status, setStatus] = useState<TReservationStatus>(reservation.status);
    const [channel, setChannel] = useState<TReservationChannel>(reservation.channel);
    const [roomRate, setRoomRate] = useState(String(reservation.roomRate));
    const [cleaningFee, setCleaningFee] = useState(String(reservation.cleaningFee));

    const mutation = useMutation({
      mutationFn: () =>
        reservationsApi.update(propertyId, reservation.id, {
          channel,
          checkIn,
          checkOut,
          cleaningFee: Number(cleaningFee) || 0,
          guestName: guestName.trim(),
          reservationNumber: reservationNumber.trim() || null,
          roomRate: Number(roomRate) || 0,
          status,
          unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update income entry");
      },
      onSuccess: () => {
        toast.success("Income entry updated");
        invalidatePropertyReservationCaches(queryClient, propertyId);
        onOpenChange(false);
      },
    });

    const canSubmit =
      unitId !== "" &&
      guestName.trim() !== "" &&
      checkIn !== "" &&
      checkOut !== "" &&
      !mutation.isPending;

    return (
      <Dialog onOpenChange={() => onOpenChange(false)} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Income Entry</DialogTitle>
            <DialogDescription>Update stay details and amounts.</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-reservation-unit">Unit</Label>
              <select
                className={reservationSelectClassName}
                id="edit-reservation-unit"
                onChange={(e) => setUnitId(e.target.value)}
                value={unitId}
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber} ({unit.layout})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-guest-name">Guest name</Label>
              <Input
                autoFocus
                id="edit-guest-name"
                onChange={(e) => setGuestName(e.target.value)}
                value={guestName}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-reservation-number">Reservation number (optional)</Label>
              <Input
                id="edit-reservation-number"
                onChange={(e) => setReservationNumber(e.target.value)}
                value={reservationNumber}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-check-in">Check-in</Label>
                <Input
                  id="edit-check-in"
                  onChange={(e) => setCheckIn(e.target.value)}
                  type="date"
                  value={checkIn}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-check-out">Check-out</Label>
                <Input
                  id="edit-check-out"
                  onChange={(e) => setCheckOut(e.target.value)}
                  type="date"
                  value={checkOut}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-reservation-status">Status</Label>
                <select
                  className={reservationSelectClassName}
                  id="edit-reservation-status"
                  onChange={(e) => setStatus(e.target.value as TReservationStatus)}
                  value={status}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-reservation-channel">Channel</Label>
                <select
                  className={reservationSelectClassName}
                  id="edit-reservation-channel"
                  onChange={(e) => setChannel(e.target.value as TReservationChannel)}
                  value={channel}
                >
                  {CHANNEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-room-rate">Room rate</Label>
                <Input
                  id="edit-room-rate"
                  inputMode="decimal"
                  onChange={(e) => setRoomRate(e.target.value)}
                  type="text"
                  value={roomRate}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cleaning-fee">Cleaning fee</Label>
                <Input
                  id="edit-cleaning-fee"
                  inputMode="decimal"
                  onChange={(e) => setCleaningFee(e.target.value)}
                  type="text"
                  value={cleaningFee}
                />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              Current totals: Gross {formatMoney(reservation.grossIncome)} · Net{" "}
              {formatMoney(reservation.netIncome)} (recalculated on save)
            </p>
          </div>

          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
EditReservationDialog.displayName = "EditReservationDialog";
