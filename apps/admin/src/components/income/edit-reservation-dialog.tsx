import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { buildChannelOptions, STATUS_OPTIONS } from "@/components/income/reservation-form-options";
import {
  reservationFormSchema,
  reservationToFormValues,
  type TReservationFormValues,
} from "@/components/income/reservation-form-schema";
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
  shouldClearCheckOutOnCheckInChange,
} from "@/lib/reservation-date-utils";
import { type IPropertyReservation, type IPropertyUnit } from "@/packages/shared";

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

    const form = useForm<TReservationFormValues>({
      defaultValues: reservationToFormValues(reservation),
      resolver: zodResolver(reservationFormSchema),
    });

    const checkIn = form.watch("checkIn");
    const checkOut = form.watch("checkOut");
    const channelCommissionId = form.watch("channelCommissionId");
    const cleaningFee = form.watch("cleaningFee");

    const selectedChannel = settingsQuery.data?.settings.channelCommissions.find(
      (channel) => channel.id === channelCommissionId
    );

    const minCheckOutDate = getMinCheckOutDate(checkIn);

    const mutation = useMutation({
      mutationFn: (values: TReservationFormValues) =>
        shortStaysApi.update(propertyId, reservation.id, {
          channelCommissionId: values.channelCommissionId,
          checkIn: values.checkIn,
          checkOut: values.checkOut,
          cleaningFee: Number(values.cleaningFee) || 0,
          guestName: values.guestName,
          reservationNumber: values.reservationNumber.trim() || null,
          roomTotal: Number(values.roomTotal) || 0,
          status: values.status,
          unitId: values.unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update income entry");
      },
      onSuccess: () => {
        toast.success("Income entry updated");
        invalidatePropertyIncomeCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(reservationToFormValues(reservation));
        }
        onOpenChange(nextOpen);
      },
      [form, onOpenChange, reservation]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Income Entry</DialogTitle>
            <DialogDescription>Update stay details and amounts.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <DialogFormFields>
              <FormSelectField
                error={errors.unitId?.message}
                id="edit-reservation-unit"
                label="Unit"
                {...form.register("unitId")}
              >
                <PropertyUnitSelectOptions units={units} />
              </FormSelectField>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-guest-name">Guest name</Label>
                <Input autoFocus id="edit-guest-name" {...form.register("guestName")} />
                {errors.guestName ? (
                  <p className="text-xs text-destructive">{errors.guestName.message}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="edit-reservation-number" optional>
                  Reservation number
                </FieldLabel>
                <Input id="edit-reservation-number" {...form.register("reservationNumber")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-check-in">Check-in</Label>
                  <Controller
                    control={form.control}
                    name="checkIn"
                    render={({ field }) => (
                      <Input
                        id="edit-check-in"
                        onChange={(e) => {
                          const nextCheckIn = e.target.value;
                          field.onChange(nextCheckIn);
                          const currentCheckOut = form.getValues("checkOut");
                          if (shouldClearCheckOutOnCheckInChange(nextCheckIn, currentCheckOut)) {
                            form.setValue("checkOut", "");
                          }
                        }}
                        type="date"
                        value={field.value}
                      />
                    )}
                  />
                  {errors.checkIn ? (
                    <p className="text-xs text-destructive">{errors.checkIn.message}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-check-out">Check-out</Label>
                  <Input
                    id="edit-check-out"
                    min={minCheckOutDate}
                    type="date"
                    {...form.register("checkOut")}
                  />
                  {errors.checkOut ? (
                    <p className="text-xs text-destructive">{errors.checkOut.message}</p>
                  ) : null}
                </div>
              </div>

              <p className="text-muted-foreground text-xs">
                Check-out must be at least one night after check-in.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelectField
                  error={errors.status?.message}
                  id="edit-reservation-status"
                  label="Status"
                  options={STATUS_OPTIONS}
                  {...form.register("status")}
                />
                <FormSelectField
                  error={errors.channelCommissionId?.message}
                  id="edit-reservation-channel"
                  label="Channel"
                  options={channelOptions}
                  {...form.register("channelCommissionId")}
                />
              </div>

              {selectedChannel?.excludeCleaningFromCommissionBase && Number(cleaningFee) > 0 ? (
                <p className="text-muted-foreground text-xs">
                  This channel&apos;s commission is calculated on room total only.
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="roomTotal"
                  render={({ field }) => (
                    <div className="flex flex-col gap-1.5">
                      <ReservationRoomTotalField
                        checkIn={checkIn}
                        checkOut={checkOut}
                        id="edit-room-total"
                        onChange={field.onChange}
                        value={field.value}
                      />
                      {errors.roomTotal ? (
                        <p className="text-xs text-destructive">{errors.roomTotal.message}</p>
                      ) : null}
                    </div>
                  )}
                />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-cleaning-fee">Cleaning fee</Label>
                  <Controller
                    control={form.control}
                    name="cleaningFee"
                    render={({ field }) => (
                      <Input
                        id="edit-cleaning-fee"
                        inputMode="decimal"
                        onChange={(e) => {
                          if (isValidDecimalInput(e.target.value)) {
                            field.onChange(e.target.value);
                          }
                        }}
                        type="text"
                        value={field.value}
                      />
                    )}
                  />
                  {errors.cleaningFee ? (
                    <p className="text-xs text-destructive">{errors.cleaningFee.message}</p>
                  ) : null}
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
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={mutation.isPending || isSubmitting} type="submit">
                {mutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
EditReservationDialog.displayName = "EditReservationDialog";
