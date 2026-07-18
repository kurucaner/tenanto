import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { buildChannelOptions, STATUS_OPTIONS } from "@/components/income/reservation-form-options";
import { ReservationRoomTotalField } from "@/components/income/reservation-room-total-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { settingsApi, shortStaysApi } from "@/lib/api-client";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { queryKeys } from "@/lib/query-keys";
import {
  getMinCheckOutDate,
  isValidStayDateRange,
  shouldClearCheckOutOnCheckInChange,
} from "@/lib/reservation-date-utils";
import {
  type IPropertyReservation,
  type IPropertyUnit,
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
    const settingsQuery = useQuery({
      enabled: open,
      queryFn: () => settingsApi.get(propertyId),
      queryKey: queryKeys.propertySettings(propertyId),
    });
    const channelOptions = useMemo(
      () => buildChannelOptions(settingsQuery.data?.settings.channelCommissions ?? []),
      [settingsQuery.data?.settings.channelCommissions]
    );
    const [unitId, setUnitId] = useState(reservation.unitId);
    const [guestName, setGuestName] = useState(reservation.guestName);
    const [reservationNumber, setReservationNumber] = useState(reservation.reservationNumber ?? "");
    const [checkIn, setCheckIn] = useState(reservation.checkIn);
    const [checkOut, setCheckOut] = useState(reservation.checkOut);
    const [status, setStatus] = useState<TReservationStatus>(reservation.status);
    const [channelCommissionId, setChannelCommissionId] = useState(reservation.channelCommissionId);
    const [roomTotal, setRoomTotal] = useState(String(reservation.roomTotal));
    const [cleaningFee, setCleaningFee] = useState(String(reservation.cleaningFee));

    const selectedChannel = settingsQuery.data?.settings.channelCommissions.find(
      (channel) => channel.id === channelCommissionId
    );

    const mutation = useMutation({
      mutationFn: () =>
        shortStaysApi.update(propertyId, reservation.id, {
          channelCommissionId,
          checkIn,
          checkOut,
          cleaningFee: Number(cleaningFee) || 0,
          guestName: guestName.trim(),
          reservationNumber: reservationNumber.trim() || null,
          roomTotal: Number(roomTotal) || 0,
          status,
          unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update income entry");
      },
      onSuccess: () => {
        toast.success("Income entry updated");
        invalidatePropertyIncomeCaches(queryClient, propertyId);
        onOpenChange(false);
      },
    });

    const handleCheckInChange = useCallback((nextCheckIn: string) => {
      setCheckIn(nextCheckIn);
      setCheckOut((currentCheckOut) =>
        shouldClearCheckOutOnCheckInChange(nextCheckIn, currentCheckOut) ? "" : currentCheckOut
      );
    }, []);

    const minCheckOutDate = getMinCheckOutDate(checkIn);
    const canSubmit =
      unitId !== "" &&
      guestName.trim() !== "" &&
      checkIn !== "" &&
      checkOut !== "" &&
      isValidStayDateRange(checkIn, checkOut) &&
      !mutation.isPending;

    return (
      <Dialog onOpenChange={() => onOpenChange(false)} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Income Entry</DialogTitle>
            <DialogDescription>Update stay details and amounts.</DialogDescription>
          </DialogHeader>

          <DialogFormFields>
            <FormSelectField
              id="edit-reservation-unit"
              label="Unit"
              onChange={(e) => setUnitId(e.target.value)}
              value={unitId}
            >
              <PropertyUnitSelectOptions units={units} />
            </FormSelectField>

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
              <FieldLabel htmlFor="edit-reservation-number" optional>
                Reservation number
              </FieldLabel>
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
                  onChange={(e) => handleCheckInChange(e.target.value)}
                  type="date"
                  value={checkIn}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-check-out">Check-out</Label>
                <Input
                  id="edit-check-out"
                  min={minCheckOutDate}
                  onChange={(e) => setCheckOut(e.target.value)}
                  type="date"
                  value={checkOut}
                />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              Check-out must be at least one night after check-in.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelectField
                id="edit-reservation-status"
                label="Status"
                onChange={(e) => setStatus(e.target.value as TReservationStatus)}
                options={STATUS_OPTIONS}
                value={status}
              />
              <FormSelectField
                id="edit-reservation-channel"
                label="Channel"
                onChange={(e) => setChannelCommissionId(e.target.value)}
                options={channelOptions}
                value={channelCommissionId}
              />
            </div>

            {selectedChannel?.excludeCleaningFromCommissionBase && Number(cleaningFee) > 0 ? (
              <p className="text-muted-foreground text-xs">
                This channel&apos;s commission is calculated on room total only.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <ReservationRoomTotalField
                checkIn={checkIn}
                checkOut={checkOut}
                id="edit-room-total"
                onChange={setRoomTotal}
                value={roomTotal}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-cleaning-fee">Cleaning fee</Label>
                <Input
                  id="edit-cleaning-fee"
                  inputMode="decimal"
                  onChange={(e) => {
                    if (isValidDecimalInput(e.target.value)) setCleaningFee(e.target.value);
                  }}
                  type="text"
                  value={cleaningFee}
                />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              Current totals: Gross {formatMoney(reservation.grossIncome)} · Net{" "}
              {formatMoney(reservation.netIncome)} (recalculated on save)
            </p>
          </DialogFormFields>

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
