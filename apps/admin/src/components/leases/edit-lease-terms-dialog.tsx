import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { LeaseDepositPresetFields } from "@/components/leases/lease-deposit-preset-fields";
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
import { getLeaseDepositFormDefaults } from "@/lib/lease-deposit-display";
import { getEditLeaseFirstPeriodRentPreview } from "@/lib/lease-proration-display";
import {
  buildLeaseTermApiPayload,
  getInitialLeaseTermEndValues,
  getLeaseTermEndErrorPath,
  refineLeaseTermEndFormValues,
  resolveLeaseTermEndPreview,
} from "@/lib/lease-term-end-utils";
import { requiredNonNegativeMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  leaseDepositPresetSchema,
  refineLeaseDepositFormValues,
  resolveStartLeaseSecurityDepositAmount,
} from "@/lib/start-lease-deposit-field";
import {
  getStartLeaseRentAmountLabel,
  normalizeStartLeaseRentBillingCadence,
} from "@/lib/start-lease-rent-billing";
import {
  deriveTermWeeksFromDates,
  getLeaseRentAmount,
  type IPropertyLongStay,
  RentBillingCadence,
  resolveSecurityDepositTracksRent,
  validateEditLeaseTerms,
} from "@/packages/shared";

function getDefaultValues(lease: IPropertyLongStay) {
  const rentAmount = getLeaseRentAmount(lease);
  return {
    ...getInitialLeaseTermEndValues({
      leaseEndDate: lease.leaseEndDate,
      leaseStartDate: lease.leaseStartDate,
      rentBillingCadence: lease.rentBillingCadence,
      termMonths: lease.termMonths,
    }),
    ...getLeaseDepositFormDefaults({
      rentAmount,
      securityDepositAmount: lease.securityDepositAmount,
      securityDepositTracksRent: lease.securityDepositTracksRent,
    }),
    rentAmount: String(rentAmount),
    termWeeks: String(deriveTermWeeksFromDates(lease.leaseStartDate, lease.leaseEndDate)),
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
    const rentAmountLabel = getStartLeaseRentAmountLabel(
      normalizeStartLeaseRentBillingCadence(lease.rentBillingCadence)
    );
    const isWeeklyLease =
      normalizeStartLeaseRentBillingCadence(lease.rentBillingCadence) === RentBillingCadence.WEEKLY;

    const form = useForm<TEditLeaseTermsFormValues>({
      defaultValues: getDefaultValues(lease),
      resolver: zodResolver(
        z
          .object({
            leaseEndDate: z.string(),
            leaseStartDate: z.string().min(1, "Lease start date is required"),
            rentAmount: requiredNonNegativeMoneyField(rentAmountLabel),
            securityDepositCustomAmount: z.string(),
            securityDepositPreset: leaseDepositPresetSchema,
            termMode: z.enum(["months", "weeks", "customEnd"]),
            termMonths: z.string(),
            termWeeks: z.string(),
          })
          .superRefine((values, ctx) => {
            refineLeaseTermEndFormValues(values, ctx);
            refineLeaseDepositFormValues(values, ctx);

            const rentAmount = Number(values.rentAmount);
            const securityDepositAmount = resolveStartLeaseSecurityDepositAmount({
              rentAmount: values.rentAmount,
              securityDepositCustomAmount: values.securityDepositCustomAmount,
              securityDepositPreset: values.securityDepositPreset,
            });
            const error = validateEditLeaseTerms(
              {
                ...buildLeaseTermApiPayload(values),
                rentAmount,
                securityDepositAmount,
                securityDepositTracksRent: resolveSecurityDepositTracksRent(
                  values.securityDepositPreset
                ),
              },
              lease,
              today
            );
            if (error) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
                path: [getLeaseTermEndErrorPath(values.termMode)],
              });
            }
          })
      ),
    });

    const handleOpenChangeWithReset = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(getDefaultValues(lease));
        }
        onOpenChange(nextOpen);
      },
      [form, lease, onOpenChange]
    );

    const termFields = form.watch([
      "leaseEndDate",
      "leaseStartDate",
      "termMode",
      "termMonths",
      "termWeeks",
    ]);
    const rentAmount = form.watch("rentAmount");

    const leaseEndDate = useMemo(() => {
      const [leaseEndDateValue, leaseStartDate, termMode, termMonths, termWeeks] = termFields;
      return resolveLeaseTermEndPreview({
        leaseEndDate: leaseEndDateValue,
        leaseStartDate,
        termMode,
        termMonths,
        termWeeks,
      });
    }, [termFields]);

    const firstMonthRentPreview = useMemo(() => {
      const parsedRentAmount = Number(rentAmount);
      const [leaseEndDateValue, leaseStartDate, termMode, termMonths, termWeeks] = termFields;
      const resolvedEnd = resolveLeaseTermEndPreview({
        leaseEndDate: leaseEndDateValue,
        leaseStartDate,
        termMode,
        termMonths,
        termWeeks,
      });

      if (
        !resolvedEnd ||
        leaseStartDate === "" ||
        !Number.isFinite(parsedRentAmount) ||
        parsedRentAmount < 0
      ) {
        return null;
      }

      return getEditLeaseFirstPeriodRentPreview({
        leaseEndDate: resolvedEnd,
        leaseStartDate,
        rentAmount: parsedRentAmount,
        rentBillingCadence: normalizeStartLeaseRentBillingCadence(lease.rentBillingCadence),
      });
    }, [lease.rentBillingCadence, rentAmount, termFields]);

    const mutation = useMutation({
      mutationFn: (values: TEditLeaseTermsFormValues) =>
        longStaysApi.updateTerms(propertyId, lease.id, {
          ...buildLeaseTermApiPayload(values),
          rentAmount: Number(values.rentAmount),
          securityDepositAmount: resolveStartLeaseSecurityDepositAmount({
            rentAmount: values.rentAmount,
            securityDepositCustomAmount: values.securityDepositCustomAmount,
            securityDepositPreset: values.securityDepositPreset,
          }),
          securityDepositTracksRent: resolveSecurityDepositTracksRent(values.securityDepositPreset),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to update lease terms");
      },
      onSuccess: () => {
        toast.success("Lease terms updated");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        handleOpenChangeWithReset(false);
      },
    });

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChangeWithReset} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit Lease Terms</DialogTitle>
            <DialogDescription>
              Correct the lease start date, term, or base{" "}
              {isWeeklyLease ? "weekly rent" : "monthly rent"} for {lease.guestName}. This is only
              available before rent income or online payments are recorded.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <DialogFormFields>
              <LeaseTermEndFields<TEditLeaseTermsFormValues>
                control={form.control}
                endDateFieldId="edit-lease-end-date"
                leaseEndDateError={errors.leaseEndDate?.message}
                leaseStartDateError={errors.leaseStartDate?.message}
                register={form.register}
                rentBillingCadence={lease.rentBillingCadence}
                resolvedEndDate={leaseEndDate}
                startDateFieldId="edit-lease-start-date"
                termMonthsError={errors.termMonths?.message}
                termMonthsFieldId="edit-lease-term-months"
                termWeeksError={errors.termWeeks?.message}
                termWeeksFieldId="edit-lease-term-weeks"
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-lease-monthly-rent">{rentAmountLabel}</Label>
                <Controller
                  control={form.control}
                  name="rentAmount"
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
                {errors.rentAmount ? (
                  <p className="text-xs text-destructive">{errors.rentAmount.message}</p>
                ) : null}
              </div>

              <LeaseDepositPresetFields<TEditLeaseTermsFormValues>
                control={form.control}
                customAmountError={errors.securityDepositCustomAmount?.message}
                customAmountFieldId="edit-lease-deposit-custom"
              />

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
                onClick={() => handleOpenChangeWithReset(false)}
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
