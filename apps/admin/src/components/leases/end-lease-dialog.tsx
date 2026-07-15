import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import {
  getActiveLeaseHoldoverNotice,
  getEndLeaseHoldoverHelperText,
  getEndLeaseMoveOutBoundsHelperText,
  getEndLeaseMoveOutRentPreview,
} from "@/lib/lease-proration-display";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  getEndLeaseMoveOutDateBounds,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  isActiveLeaseInHoldover,
  validateEndLeaseMoveOutDate,
} from "@/packages/shared";

type TEndLeaseFormValues = {
  actualEndDate: string;
};

interface EndLeaseDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  rentPeriods?: readonly IPropertyLongStayRentPeriod[];
}

export const EndLeaseDialog = memo(
  ({ lease, onOpenChange, open, propertyId, rentPeriods = [] }: EndLeaseDialogProps) => {
    const queryClient = useQueryClient();
    const today = getTodayLocalIsoDate();
    const { defaultDate, maxDate, minDate } = getEndLeaseMoveOutDateBounds(
      lease.leaseStartDate,
      lease.leaseEndDate,
      today
    );
    const isSingleMoveOutDate = minDate === maxDate;
    const isInHoldover = isActiveLeaseInHoldover(lease, today);

    const endLeaseSchema = useMemo(
      () =>
        z
          .object({
            actualEndDate: z.string().min(1, "Move-out date is required"),
          })
          .superRefine((values, ctx) => {
            const error = validateEndLeaseMoveOutDate(
              values.actualEndDate,
              lease.leaseStartDate,
              lease.leaseEndDate,
              today
            );
            if (error) {
              ctx.addIssue({
                code: "custom",
                message: error,
                path: ["actualEndDate"],
              });
            }
          }),
      [lease.leaseEndDate, lease.leaseStartDate, today]
    );

    const form = useForm<TEndLeaseFormValues>({
      defaultValues: {
        actualEndDate: defaultDate,
      },
      resolver: zodResolver(endLeaseSchema),
    });

    const moveOutDate = form.watch("actualEndDate");

    const boundsHelperText = useMemo(
      () => getEndLeaseMoveOutBoundsHelperText(lease.leaseStartDate, lease.leaseEndDate, today),
      [lease.leaseEndDate, lease.leaseStartDate, today]
    );

    const holdoverHelperText = useMemo(
      () => getEndLeaseHoldoverHelperText(moveOutDate, lease.leaseEndDate),
      [lease.leaseEndDate, moveOutDate]
    );

    const finalMonthRentPreview = useMemo(
      () =>
        getEndLeaseMoveOutRentPreview({
          lease,
          moveOutDate,
          rentPeriods,
        }),
      [lease, moveOutDate, rentPeriods]
    );

    const mutation = useMutation({
      mutationFn: (values: TEndLeaseFormValues) =>
        longStaysApi.end(propertyId, lease.id, { actualEndDate: values.actualEndDate }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to end lease");
      },
      onSuccess: () => {
        toast.success("Lease ended");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset({ actualEndDate: defaultDate });
        }
        onOpenChange(nextOpen);
      },
      [defaultDate, form, onOpenChange]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>End Lease</DialogTitle>
            <DialogDescription>
              {isInHoldover
                ? getActiveLeaseHoldoverNotice(lease.leaseEndDate)
                : `End the lease for ${lease.guestName}. The unit will become vacant.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end-lease-date">Move-out Date</Label>
                {isSingleMoveOutDate ? (
                  <>
                    <input type="hidden" {...form.register("actualEndDate")} />
                    <Input id="end-lease-date" readOnly type="date" value={minDate} />
                  </>
                ) : (
                  <Input
                    id="end-lease-date"
                    max={maxDate}
                    min={minDate}
                    type="date"
                    {...form.register("actualEndDate")}
                  />
                )}
                <p className="text-muted-foreground text-xs">{boundsHelperText}</p>
                {holdoverHelperText ? (
                  <p className="text-muted-foreground text-xs">{holdoverHelperText}</p>
                ) : null}
                {finalMonthRentPreview ? (
                  <p className="text-sm font-medium">{finalMonthRentPreview}</p>
                ) : null}
                {errors.actualEndDate ? (
                  <p className="text-xs text-destructive">{errors.actualEndDate.message}</p>
                ) : null}
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
              <Button
                disabled={mutation.isPending || isSubmitting}
                type="submit"
                variant="destructive"
              >
                {mutation.isPending ? "Ending…" : "End Lease"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
EndLeaseDialog.displayName = "EndLeaseDialog";
