import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { isValidIntegerInput } from "@/lib/integer-input-utils";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { getStartLeaseFirstMonthRentPreview } from "@/lib/lease-proration-display";
import { requiredNonNegativeMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  calculateLeaseEndDate,
  type IPropertyLongStay,
  MAX_LEASE_TERM_MONTHS,
  validateEditLeaseTerms,
} from "@/packages/shared";

function getDefaultValues(lease: IPropertyLongStay) {
  return {
    leaseStartDate: lease.leaseStartDate,
    monthlyRent: String(lease.monthlyRent),
    termMonths: String(lease.termMonths),
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
            leaseStartDate: z.string().min(1, "Lease start date is required"),
            monthlyRent: requiredNonNegativeMoneyField("Monthly rent"),
            termMonths: z
              .string()
              .min(1, "Term is required")
              .refine((value) => /^\d+$/.test(value), {
                message: "Term must be a whole number",
              })
              .refine(
                (value) => {
                  const parsed = Number.parseInt(value, 10);
                  return parsed >= 1 && parsed <= MAX_LEASE_TERM_MONTHS;
                },
                { message: `Term must be between 1 and ${MAX_LEASE_TERM_MONTHS}` }
              ),
          })
          .superRefine((values, ctx) => {
            const termMonths = Number.parseInt(values.termMonths, 10);
            const monthlyRent = Number(values.monthlyRent);
            const error = validateEditLeaseTerms(
              {
                leaseStartDate: values.leaseStartDate,
                monthlyRent,
                termMonths,
              },
              lease,
              today
            );
            if (error) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
                path: ["termMonths"],
              });
            }
          })
      ),
    });

    const leaseStartDate = form.watch("leaseStartDate");
    const monthlyRent = form.watch("monthlyRent");
    const termMonths = form.watch("termMonths");

    const leaseEndDate = useMemo(() => {
      const parsedTermMonths = Number.parseInt(termMonths, 10);
      if (leaseStartDate === "" || !Number.isInteger(parsedTermMonths) || parsedTermMonths < 1) {
        return null;
      }
      return calculateLeaseEndDate(leaseStartDate, parsedTermMonths);
    }, [leaseStartDate, termMonths]);

    const firstMonthRentPreview = useMemo(() => {
      const parsedTermMonths = Number.parseInt(termMonths, 10);
      const parsedMonthlyRent = Number(monthlyRent);
      if (
        leaseStartDate === "" ||
        !Number.isInteger(parsedTermMonths) ||
        parsedTermMonths < 1 ||
        !Number.isFinite(parsedMonthlyRent) ||
        parsedMonthlyRent < 0
      ) {
        return null;
      }

      return getStartLeaseFirstMonthRentPreview({
        leaseStartDate,
        monthlyRent: parsedMonthlyRent,
        termMonths: parsedTermMonths,
      });
    }, [leaseStartDate, monthlyRent, termMonths]);

    const mutation = useMutation({
      mutationFn: (values: TEditLeaseTermsFormValues) =>
        longStaysApi.updateTerms(propertyId, lease.id, {
          leaseStartDate: values.leaseStartDate,
          monthlyRent: Number(values.monthlyRent),
          termMonths: Number.parseInt(values.termMonths, 10),
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-lease-start-date">Lease Start Date</Label>
                  <Input
                    id="edit-lease-start-date"
                    type="date"
                    {...form.register("leaseStartDate")}
                  />
                  {errors.leaseStartDate ? (
                    <p className="text-xs text-destructive">{errors.leaseStartDate.message}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-lease-term-months">Term (Months)</Label>
                  <Controller
                    control={form.control}
                    name="termMonths"
                    render={({ field }) => (
                      <Input
                        id="edit-lease-term-months"
                        inputMode="numeric"
                        onChange={(e) => {
                          if (isValidIntegerInput(e.target.value)) {
                            field.onChange(e.target.value);
                          }
                        }}
                        type="text"
                        value={field.value}
                      />
                    )}
                  />
                  {errors.termMonths ? (
                    <p className="text-xs text-destructive">{errors.termMonths.message}</p>
                  ) : null}
                </div>
              </div>

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
