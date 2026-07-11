import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { buildChannelOptions, STATUS_OPTIONS } from "@/components/income/reservation-form-options";
import { ReservationRoomTotalField } from "@/components/income/reservation-room-total-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field-label";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { reservationsApi, settingsApi, unitsApi } from "@/lib/api-client";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { optionalNonNegativeMoneyField } from "@/lib/money-field-validation";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  getMinCheckOutDate,
  isValidStayDateRange,
  shouldClearCheckOutOnCheckInChange,
} from "@/lib/reservation-date-utils";
import { ReservationStatus, UnitRentalType } from "@/packages/shared";

const createReservationSchema = z
  .object({
    channelCommissionId: z.string().uuid("Channel is required"),
    checkIn: z.string().min(1, "Check-in is required"),
    checkOut: z.string().min(1, "Check-out is required"),
    cleaningFee: optionalNonNegativeMoneyField("Cleaning fee must be a non-negative number"),
    guestName: z.string().trim().min(1, "Guest name is required"),
    reservationNumber: z.string(),
    roomTotal: optionalNonNegativeMoneyField("Room total must be a non-negative number"),
    status: z.enum([
      ReservationStatus.ACTIVE,
      ReservationStatus.CANCELED,
      ReservationStatus.NO_SHOW,
      ReservationStatus.STAYED,
    ]),
    unitId: z.string().min(1, "Unit is required"),
  })
  .superRefine((values, ctx) => {
    if (!isValidStayDateRange(values.checkIn, values.checkOut)) {
      ctx.addIssue({
        code: "custom",
        message: "Check-out must be after check-in",
        path: ["checkOut"],
      });
    }
  });

type TCreateReservationFormValues = z.infer<typeof createReservationSchema>;

function getDefaultValues(defaultChannelCommissionId = ""): TCreateReservationFormValues {
  return {
    channelCommissionId: defaultChannelCommissionId,
    checkIn: "",
    checkOut: "",
    cleaningFee: "",
    guestName: "",
    reservationNumber: "",
    roomTotal: "",
    status: ReservationStatus.ACTIVE,
    unitId: "",
  };
}

interface CreateReservationDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const CreateReservationDialog = memo(
  ({ onOpenChange, open, propertyId }: CreateReservationDialogProps) => {
    const queryClient = useQueryClient();
    const settingsQuery = useQuery({
      enabled: open,
      queryFn: () => settingsApi.get(propertyId),
      queryKey: adminQueryKeys.propertySettings(propertyId),
    });

    const channelOptions = useMemo(
      () => buildChannelOptions(settingsQuery.data?.settings.channelCommissions ?? []),
      [settingsQuery.data?.settings.channelCommissions]
    );

    const defaultChannelCommissionId = channelOptions[0]?.value ?? "";

    const form = useForm<TCreateReservationFormValues>({
      defaultValues: getDefaultValues(defaultChannelCommissionId),
      resolver: zodResolver(createReservationSchema),
    });

    const unitsQuery = useQuery({
      enabled: open,
      queryFn: () => unitsApi.list(propertyId),
      queryKey: adminQueryKeys.propertyUnits(propertyId),
    });

    const checkIn = form.watch("checkIn");
    const checkOut = form.watch("checkOut");
    const channelCommissionId = form.watch("channelCommissionId");
    const cleaningFee = form.watch("cleaningFee");

    const selectedChannel = settingsQuery.data?.settings.channelCommissions.find(
      (channel) => channel.id === channelCommissionId
    );

    const shortTermUnits = useMemo(
      () =>
        (unitsQuery.data?.units ?? []).filter(
          (unit) => unit.rentalType === UnitRentalType.SHORT_TERM && !unit.isDeleted
        ),
      [unitsQuery.data?.units]
    );

    const minCheckOutDate = getMinCheckOutDate(checkIn);

    const mutation = useMutation({
      mutationFn: (values: TCreateReservationFormValues) =>
        reservationsApi.create(propertyId, {
          channelCommissionId: values.channelCommissionId,
          checkIn: values.checkIn,
          checkOut: values.checkOut,
          cleaningFee: Number(values.cleaningFee) || 0,
          guestName: values.guestName.trim(),
          reservationNumber: values.reservationNumber.trim() || undefined,
          roomTotal: Number(values.roomTotal) || 0,
          status: values.status,
          unitId: values.unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create income entry");
      },
      onSuccess: () => {
        toast.success("Income entry created");
        invalidatePropertyIncomeCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(getDefaultValues(defaultChannelCommissionId));
        }
        onOpenChange(nextOpen);
      },
      [defaultChannelCommissionId, form, onOpenChange]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add Short Stay</DialogTitle>
            <DialogDescription>Record guest stay income for a short-term unit.</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
              <FormSelectField
                error={errors.unitId?.message}
                id="reservation-unit"
                label="Unit"
                {...form.register("unitId")}
              >
                <PropertyUnitSelectOptions emptyOptionLabel="Select unit…" units={shortTermUnits} />
              </FormSelectField>
              {!unitsQuery.isLoading && shortTermUnits.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No short-term units configured. Add a short-term unit to record stay income.
                </p>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="guest-name">Guest name</Label>
                <Input autoFocus id="guest-name" {...form.register("guestName")} />
                {errors.guestName ? (
                  <p className="text-xs text-destructive">{errors.guestName.message}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="reservation-number" optional>
                  Reservation number
                </FieldLabel>
                <Input id="reservation-number" {...form.register("reservationNumber")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="check-in">Check-in</Label>
                  <Controller
                    control={form.control}
                    name="checkIn"
                    render={({ field }) => (
                      <Input
                        id="check-in"
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
                  <Label htmlFor="check-out">Check-out</Label>
                  <Input
                    id="check-out"
                    min={minCheckOutDate}
                    type="date"
                    {...form.register("checkOut")}
                  />
                  {errors.checkOut ? (
                    <p className="text-xs text-destructive">{errors.checkOut.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelectField
                  error={errors.status?.message}
                  id="reservation-status"
                  label="Status"
                  options={STATUS_OPTIONS}
                  {...form.register("status")}
                />
                <FormSelectField
                  error={errors.channelCommissionId?.message}
                  id="reservation-channel"
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
                        id="room-total"
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
                  <Label htmlFor="cleaning-fee">Cleaning fee</Label>
                  <Controller
                    control={form.control}
                    name="cleaningFee"
                    render={({ field }) => (
                      <Input
                        id="cleaning-fee"
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
            </div>

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
                {mutation.isPending ? "Creating…" : "Add Income"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateReservationDialog.displayName = "CreateReservationDialog";
