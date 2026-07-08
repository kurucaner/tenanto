import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
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
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { reservationsApi, unitsApi } from "@/lib/api-client";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  getMinCheckOutDate,
  getTodayLocalIsoDate,
  isValidStayDateRange,
  shouldClearCheckOutOnCheckInChange,
} from "@/lib/reservation-date-utils";
import {
  ReservationChannel,
  ReservationStatus,
  type TReservationChannel,
  type TReservationStatus,
  UnitRentalType,
} from "@/packages/shared";

interface CreateReservationDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateReservationDialog = memo(
  ({ onOpenChange, open, propertyId }: CreateReservationDialogProps) => {
    const queryClient = useQueryClient();
    const [unitId, setUnitId] = useState("");
    const [guestName, setGuestName] = useState("");
    const [reservationNumber, setReservationNumber] = useState("");
    const [checkIn, setCheckIn] = useState("");
    const [checkOut, setCheckOut] = useState("");
    const [status, setStatus] = useState<TReservationStatus>(ReservationStatus.ACTIVE);
    const [channel, setChannel] = useState<TReservationChannel>(ReservationChannel.AIRBNB);
    const [roomRate, setRoomRate] = useState("");
    const [cleaningFee, setCleaningFee] = useState("");

    const unitsQuery = useQuery({
      enabled: open,
      queryFn: () => unitsApi.list(propertyId),
      queryKey: adminQueryKeys.propertyUnits(propertyId),
    });

    const mutation = useMutation({
      mutationFn: () =>
        reservationsApi.create(propertyId, {
          channel,
          checkIn,
          checkOut,
          cleaningFee: Number(cleaningFee) || 0,
          guestName: guestName.trim(),
          reservationNumber: reservationNumber.trim() || undefined,
          roomRate: Number(roomRate) || 0,
          status,
          unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create income entry");
      },
      onSuccess: () => {
        toast.success("Income entry created");
        invalidatePropertyIncomeCaches(queryClient, propertyId);
        handleClose();
      },
    });

    const handleClose = () => {
      onOpenChange(false);
      setUnitId("");
      setGuestName("");
      setReservationNumber("");
      setCheckIn("");
      setCheckOut("");
      setStatus(ReservationStatus.ACTIVE);
      setChannel(ReservationChannel.AIRBNB);
      setRoomRate("");
      setCleaningFee("");
    };

    const handleCheckInChange = useCallback((nextCheckIn: string) => {
      setCheckIn(nextCheckIn);
      setCheckOut((currentCheckOut) =>
        shouldClearCheckOutOnCheckInChange(nextCheckIn, currentCheckOut) ? "" : currentCheckOut
      );
    }, []);

    const shortTermUnits = useMemo(
      () =>
        (unitsQuery.data?.units ?? []).filter(
          (unit) => unit.rentalType === UnitRentalType.SHORT_TERM
        ),
      [unitsQuery.data?.units]
    );
    const minCheckInDate = getTodayLocalIsoDate();
    const minCheckOutDate = getMinCheckOutDate(checkIn);
    const canSubmit =
      unitId !== "" &&
      guestName.trim() !== "" &&
      checkIn !== "" &&
      checkIn >= minCheckInDate &&
      checkOut !== "" &&
      isValidStayDateRange(checkIn, checkOut) &&
      !mutation.isPending;

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add Short Stay</DialogTitle>
            <DialogDescription>
              Record guest stay income for a short-term unit.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reservation-unit">Unit</Label>
              <select
                className={reservationSelectClassName}
                id="reservation-unit"
                onChange={(e) => setUnitId(e.target.value)}
                value={unitId}
              >
                <PropertyUnitSelectOptions emptyOptionLabel="Select unit…" units={shortTermUnits} />
              </select>
              {!unitsQuery.isLoading && shortTermUnits.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No short-term units configured. Add a short-term unit to record stay income.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guest-name">Guest name</Label>
              <Input
                autoFocus
                id="guest-name"
                onChange={(e) => setGuestName(e.target.value)}
                value={guestName}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reservation-number">Reservation number (optional)</Label>
              <Input
                id="reservation-number"
                onChange={(e) => setReservationNumber(e.target.value)}
                value={reservationNumber}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="check-in">Check-in</Label>
                <Input
                  id="check-in"
                  min={minCheckInDate}
                  onChange={(e) => handleCheckInChange(e.target.value)}
                  type="date"
                  value={checkIn}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="check-out">Check-out</Label>
                <Input
                  id="check-out"
                  min={minCheckOutDate}
                  onChange={(e) => setCheckOut(e.target.value)}
                  type="date"
                  value={checkOut}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reservation-status">Status</Label>
                <select
                  className={reservationSelectClassName}
                  id="reservation-status"
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
                <Label htmlFor="reservation-channel">Channel</Label>
                <select
                  className={reservationSelectClassName}
                  id="reservation-channel"
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
                <Label htmlFor="room-rate">Room rate (per night)</Label>
                <Input
                  id="room-rate"
                  inputMode="decimal"
                  onChange={(e) => setRoomRate(e.target.value)}
                  type="text"
                  value={roomRate}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cleaning-fee">Cleaning fee</Label>
                <Input
                  id="cleaning-fee"
                  inputMode="decimal"
                  onChange={(e) => setCleaningFee(e.target.value)}
                  type="text"
                  value={cleaningFee}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={handleClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
              {mutation.isPending ? "Creating…" : "Add Income"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateReservationDialog.displayName = "CreateReservationDialog";
