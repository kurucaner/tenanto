import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { LeaseTermEndFields } from "@/components/leases/lease-term-end-fields";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { longStaysApi } from "@/lib/api-client";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { getStartLeaseFirstMonthRentPreview } from "@/lib/lease-proration-display";
import {
  buildLeaseTermApiPayload,
  getInitialLeaseTermEndValues,
  refineLeaseTermEndFormValues,
  resolveLeaseTermEndPreview,
} from "@/lib/lease-term-end-utils";
import { requiredNonNegativeMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { type IPropertyLongStay, validateEditLeaseTerms } from "@/packages/shared";

function getDefaultValues(lease: IPropertyLongStay) {
  return {
    ...getInitialLeaseTermEndValues(lease),
    monthlyRent: String(lease.monthlyRent),
  };
}

type TEditLeaseTermsFormValues = ReturnType<typeof getDefaultValues>;

interface EditLeaseTermsDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const EditLeaseTermsDialog = memo(
  ({ lease, onOpenChange, open, propertyId }: EditLeaseTermsDialogProps) => {
    const queryClient = useQueryClient();
    const today = getTodayLocalIsoDate();

    const form = useForm<TEditLeaseTermsFormValues>({
      defaultValues: getDefaultValues(lease),
      resolver: zodResolver(
        z
          .object({
            leaseEndDate: z.string(),
            leaseStartDate: z.string().min(1, "Lease start date is required"),
            monthlyRent: requiredNonNegativeMoneyField("Monthly rent"),
            termMode: z.enum(["months", "customEnd"]),
            termMonths: z.string(),
          })
          .superRefine((values, ctx) => {
            refineLeaseTermEndFormValues(values, ctx);

            const monthlyRent = Number(values.monthlyRent);
            const error = validateEditLeaseTerms(
              {
                ...buildLeaseTermApiPayload(values),
                monthlyRent,
              },
              lease,
              today
            );
            if (error) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
                path: [values.termMode === "customEnd" ? "leaseEndDate" : "termMonths"],
              });
            }
          })
      ),
    });

    const termFields = form.watch(["leaseEndDate", "leaseStartDate", "termMode", "termMonths"]);
    const monthlyRent = form.watch("monthlyRent");

    const leaseEndDate = useMemo(() => {
      const [leaseEndDateValue, leaseStartDate, termMode, termMonths] = termFields;
      return resolveLeaseTermEndPreview({
        leaseEndDate: leaseEndDateValue,
        leaseStartDate,
        termMode,
        termMonths,
      });
    }, [termFields]);

    const firstMonthRentPreview = useMemo(() => {
      const parsedMonthlyRent = Number(monthlyRent);
      const [leaseEndDateValue, leaseStartDate, termMode, termMonths] = termFields;
      const resolvedEnd = resolveLeaseTermEndPreview({
        leaseEndDate: leaseEndDateValue,
        leaseStartDate,
        termMode,
        termMonths,
      });

      if (
        !resolvedEnd ||
        leaseStartDate === "" ||
        !Number.isFinite(parsedMonthlyRent) ||
        parsedMonthlyRent < 0
      ) {
        return null;
      }

      return getStartLeaseFirstMonthRentPreview({
        leaseEndDate: resolvedEnd,
        leaseStartDate,
        monthlyRent: parsedMonthlyRent,
      });
    }, [monthlyRent, termFields]);

    const mutation = useMutation({
      mutationFn: (values: TEditLeaseTermsFormValues) =>
        longStaysApi.updateTerms(propertyId, lease.id, {
          ...buildLeaseTermApiPayload(values),
          monthlyRent: Number(values.monthlyRent),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update lease terms");
      },
      onSuccess: () => {
        toast.success("Lease terms updated");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(getDefaultValues(lease));
        }
        onOpenChange(nextOpen);
      },
      [form, lease, onOpenChange]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit Lease Terms</DialogTitle>
            <DialogDescription>
              Correct the lease start date, term, or base monthly rent for {lease.guestName}. This
              is only available before rent income or online payments are recorded.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <DialogFormFields>
              <LeaseTermEndFields<TEditLeaseTermsFormValues>
                control={form.control}
                endDateFieldId="edit-lease-end-date"
                errors={errors}
                register={form.register}
                startDateFieldId="edit-lease-start-date"
                termMonthsFieldId="edit-lease-term-months"
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-lease-monthly-rent">Monthly Rent</Label>
                <Controller
                  control={form.control}
                  name="monthlyRent"
                  render={({ field }) => (
                    <Input
                      id="edit-lease-monthly-rent"
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
                {errors.monthlyRent ? (
                  <p className="text-xs text-destructive">{errors.monthlyRent.message}</p>
                ) : null}
              </div>

              {leaseEndDate ? (
                <p className="text-muted-foreground text-xs">
                  Lease ends: {new Date(`${leaseEndDate}T00:00:00`).toLocaleDateString()}
                </p>
              ) : null}

              {firstMonthRentPreview ? (
                <p className="text-sm font-medium">{firstMonthRentPreview}</p>
              ) : null}
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
EditLeaseTermsDialog.displayName = "EditLeaseTermsDialog";
