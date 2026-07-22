import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { longStaysApi } from "@/lib/api-client";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { isValidIntegerInput } from "@/lib/integer-input-utils";
import {
  invalidatePropertyLongStayCaches,
  invalidatePropertyLongStayDetailQuery,
} from "@/lib/invalidate-property-long-stay-caches";
import { getExtendDepositTopUpPreview } from "@/lib/lease-deposit-display";
import {
  getExtendLeaseChangeRentLabel,
  getExtendLeaseDepositTopUpDescription,
  getExtendLeaseDepositTopUpLabel,
  getExtendLeaseDialogDescription,
  getExtendLeaseNewRentLabel,
} from "@/lib/lease-rent-schedule-display";
import { requiredPositiveMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { normalizeStartLeaseRentBillingCadence } from "@/lib/start-lease-rent-billing";
import {
  addDaysToIsoDate,
  formatRentPeriodLabel,
  getExtensionRentEffectiveMonthOptions,
  getExtensionRentEffectiveWeekOptions,
  getFirstExtensionMonth,
  getFirstExtensionWeek,
  getLeaseRentAmount,
  type IExtendPropertyLongStayBody,
  type IPropertyLongStay,
  isWeeklyRentBillingCadence,
  MAX_ADDITIONAL_TERM_MONTHS,
  MAX_ADDITIONAL_TERM_WEEKS,
  resolveExtendLeaseEndDate,
  validateExtendLease,
} from "@/packages/shared";

const DEFAULT_ADDITIONAL_TERM_MONTHS = "6";
const DEFAULT_ADDITIONAL_TERM_WEEKS = "4";

type TExtendLeaseInputMode = "customEnd" | "months" | "weeks";

function getDefaultExtendMode(lease: IPropertyLongStay): TExtendLeaseInputMode {
  return isWeeklyRentBillingCadence(lease.rentBillingCadence) ? "weeks" : "months";
}

function getMinNewLeaseEndDate(leaseEndDate: string): string {
  return addDaysToIsoDate(leaseEndDate, 1);
}

function getDefaultNewLeaseEndDate(lease: IPropertyLongStay): string {
  if (isWeeklyRentBillingCadence(lease.rentBillingCadence)) {
    return resolveExtendLeaseEndDate(lease, { additionalWeeks: 1 }).newLeaseEndDate;
  }

  return resolveExtendLeaseEndDate(lease, { additionalTermMonths: 1 }).newLeaseEndDate;
}

function getDefaultValues(lease: IPropertyLongStay) {
  const isWeekly = isWeeklyRentBillingCadence(lease.rentBillingCadence);

  return {
    additionalTermMonths: DEFAULT_ADDITIONAL_TERM_MONTHS,
    additionalTermWeeks: DEFAULT_ADDITIONAL_TERM_WEEKS,
    changeRent: false,
    extendMode: getDefaultExtendMode(lease),
    newLeaseEndDate: getDefaultNewLeaseEndDate(lease),
    newRentAmount: String(getLeaseRentAmount(lease)),
    rentEffectiveFromPeriod: isWeekly
      ? getFirstExtensionWeek(lease.leaseStartDate, lease.leaseEndDate)
      : getFirstExtensionMonth(lease.leaseEndDate),
    topUpSecurityDeposit: true,
  };
}

type TExtendLeaseFormValues = ReturnType<typeof getDefaultValues>;

function buildExtendLeaseApiPayload(values: TExtendLeaseFormValues): IExtendPropertyLongStayBody {
  if (values.extendMode === "customEnd") {
    return { newLeaseEndDate: values.newLeaseEndDate };
  }

  if (values.extendMode === "weeks") {
    return { additionalWeeks: Number.parseInt(values.additionalTermWeeks, 10) };
  }

  return { additionalTermMonths: Number.parseInt(values.additionalTermMonths, 10) };
}

function buildExtendLeaseMutationBody(
  values: TExtendLeaseFormValues,
  includeTopUp: boolean
): IExtendPropertyLongStayBody {
  return {
    ...buildExtendLeaseApiPayload(values),
    ...(values.changeRent
      ? {
          newRentAmount: Number(values.newRentAmount),
          rentEffectiveFromPeriod: values.rentEffectiveFromPeriod,
          ...(includeTopUp && values.topUpSecurityDeposit ? { topUpSecurityDeposit: true } : {}),
        }
      : {}),
  };
}

interface ExtendLeaseDialogProps {
  lease: IPropertyLongStay;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const ExtendLeaseDialog = memo(
  ({ lease, onOpenChange, open, propertyId }: ExtendLeaseDialogProps) => {
    const queryClient = useQueryClient();
    const today = getTodayLocalIsoDate();
    const rentBillingCadence = normalizeStartLeaseRentBillingCadence(lease.rentBillingCadence);
    const isWeekly = isWeeklyRentBillingCadence(rentBillingCadence);
    const extendDialogDescription = getExtendLeaseDialogDescription(rentBillingCadence);
    const changeRentLabel = getExtendLeaseChangeRentLabel(rentBillingCadence);
    const newRentLabel = getExtendLeaseNewRentLabel(rentBillingCadence);

    const form = useForm<TExtendLeaseFormValues>({
      defaultValues: getDefaultValues(lease),
      resolver: zodResolver(
        z
          .object({
            additionalTermMonths: z.string(),
            additionalTermWeeks: z.string(),
            changeRent: z.boolean(),
            extendMode: z.enum(["months", "weeks", "customEnd"]),
            newLeaseEndDate: z.string(),
            newRentAmount: z.string(),
            rentEffectiveFromPeriod: z.string(),
            topUpSecurityDeposit: z.boolean(),
          })
          .superRefine((values, ctx) => {
            const topUpOffer =
              values.changeRent && values.newRentAmount !== ""
                ? getExtendDepositTopUpPreview({
                    currentExpected: lease.securityDepositAmount,
                    newRentAmount: Number(values.newRentAmount),
                    tracksRent: lease.securityDepositTracksRent,
                  })
                : null;

            const body = buildExtendLeaseMutationBody(values, topUpOffer?.eligible === true);
            const error = validateExtendLease(body, lease, today);
            if (error) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
                path: [
                  values.extendMode === "customEnd"
                    ? "newLeaseEndDate"
                    : values.extendMode === "weeks"
                      ? "additionalTermWeeks"
                      : "additionalTermMonths",
                ],
              });
            }

            if (values.extendMode === "months") {
              if (!/^\d+$/.test(values.additionalTermMonths)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "Additional term must be a whole number",
                  path: ["additionalTermMonths"],
                });
              } else {
                const parsed = Number.parseInt(values.additionalTermMonths, 10);
                if (parsed < 1 || parsed > MAX_ADDITIONAL_TERM_MONTHS) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Additional term must be between 1 and ${MAX_ADDITIONAL_TERM_MONTHS}`,
                    path: ["additionalTermMonths"],
                  });
                }
              }
            } else if (values.extendMode === "weeks") {
              if (!/^\d+$/.test(values.additionalTermWeeks)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "Additional term must be a whole number",
                  path: ["additionalTermWeeks"],
                });
              } else {
                const parsed = Number.parseInt(values.additionalTermWeeks, 10);
                if (parsed < 1 || parsed > MAX_ADDITIONAL_TERM_WEEKS) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Additional term must be between 1 and ${MAX_ADDITIONAL_TERM_WEEKS}`,
                    path: ["additionalTermWeeks"],
                  });
                }
              }
            } else if (values.newLeaseEndDate === "") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "New lease end date is required",
                path: ["newLeaseEndDate"],
              });
            }

            if (values.changeRent) {
              const rentResult = requiredPositiveMoneyField(newRentLabel).safeParse(
                values.newRentAmount
              );
              if (!rentResult.success) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message:
                    rentResult.error.issues[0]?.message ?? `Invalid ${newRentLabel.toLowerCase()}`,
                  path: ["newRentAmount"],
                });
              }
            }
          })
      ),
    });

    const extendMode = form.watch("extendMode");
    const additionalTermMonths = form.watch("additionalTermMonths");
    const additionalTermWeeks = form.watch("additionalTermWeeks");
    const newLeaseEndDateValue = form.watch("newLeaseEndDate");
    const changeRent = form.watch("changeRent");
    const newRentAmountValue = form.watch("newRentAmount");

    const extendBody = useMemo(
      () =>
        buildExtendLeaseApiPayload({
          additionalTermMonths,
          additionalTermWeeks,
          changeRent,
          extendMode,
          newLeaseEndDate: newLeaseEndDateValue,
          newRentAmount: "",
          rentEffectiveFromPeriod: "",
          topUpSecurityDeposit: true,
        }),
      [additionalTermMonths, additionalTermWeeks, changeRent, extendMode, newLeaseEndDateValue]
    );

    const newLeaseEndDate = useMemo(() => {
      try {
        return resolveExtendLeaseEndDate(lease, extendBody).newLeaseEndDate;
      } catch {
        return null;
      }
    }, [extendBody, lease]);

    const depositTopUpPreview = useMemo(() => {
      if (!changeRent || newRentAmountValue === "") {
        return null;
      }
      const parsedRent = Number(newRentAmountValue);
      if (!Number.isFinite(parsedRent)) {
        return null;
      }
      const offer = getExtendDepositTopUpPreview({
        currentExpected: lease.securityDepositAmount,
        newRentAmount: parsedRent,
        tracksRent: lease.securityDepositTracksRent,
      });
      if (!offer.eligible) {
        return null;
      }
      return {
        description: getExtendLeaseDepositTopUpDescription(),
        label: getExtendLeaseDepositTopUpLabel(offer.topUpDelta),
      };
    }, [
      changeRent,
      lease.securityDepositAmount,
      lease.securityDepositTracksRent,
      newRentAmountValue,
    ]);

    const effectivePeriodOptions = useMemo(() => {
      if (!newLeaseEndDate) {
        return [];
      }

      if (isWeekly) {
        return getExtensionRentEffectiveWeekOptions(
          lease.leaseStartDate,
          lease.leaseEndDate,
          newLeaseEndDate
        );
      }

      return getExtensionRentEffectiveMonthOptions(lease.leaseEndDate, newLeaseEndDate);
    }, [isWeekly, lease.leaseEndDate, lease.leaseStartDate, newLeaseEndDate]);

    const defaultEffectivePeriod = isWeekly
      ? getFirstExtensionWeek(lease.leaseStartDate, lease.leaseEndDate)
      : getFirstExtensionMonth(lease.leaseEndDate);

    useEffect(() => {
      if (!changeRent || effectivePeriodOptions.length === 0) {
        return;
      }
      const currentValue = form.getValues("rentEffectiveFromPeriod");
      if (!effectivePeriodOptions.includes(currentValue)) {
        form.setValue(
          "rentEffectiveFromPeriod",
          effectivePeriodOptions[0] ?? defaultEffectivePeriod
        );
      }
    }, [changeRent, defaultEffectivePeriod, effectivePeriodOptions, form]);

    const mutation = useMutation({
      mutationFn: (values: TExtendLeaseFormValues) => {
        const topUpOffer =
          values.changeRent && values.newRentAmount !== ""
            ? getExtendDepositTopUpPreview({
                currentExpected: lease.securityDepositAmount,
                newRentAmount: Number(values.newRentAmount),
                tracksRent: lease.securityDepositTracksRent,
              })
            : null;
        return longStaysApi.extend(
          propertyId,
          lease.id,
          buildExtendLeaseMutationBody(values, topUpOffer?.eligible === true)
        );
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to extend lease");
      },
      onSuccess: () => {
        toast.success("Lease extended");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        invalidatePropertyLongStayDetailQuery(queryClient, propertyId, lease.id);
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
    const termFieldError =
      extendMode === "weeks" ? errors.additionalTermWeeks : errors.additionalTermMonths;
    const termFieldName = extendMode === "weeks" ? "additionalTermWeeks" : "additionalTermMonths";
    const termFieldId = extendMode === "weeks" ? "extend-lease-term-weeks" : "extend-lease-term";
    const termFieldValue = extendMode === "weeks" ? additionalTermWeeks : additionalTermMonths;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Extend Lease</DialogTitle>
            <DialogDescription>{extendDialogDescription}</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <DialogFormFields>
              <RadioGroupFieldset
                legend="Extension length"
                onValueChange={(value) =>
                  form.setValue("extendMode", value as TExtendLeaseInputMode)
                }
                value={extendMode}
              >
                {isWeekly ? (
                  <RadioOption label="Additional weeks" value="weeks" />
                ) : (
                  <RadioOption label="Additional months" value="months" />
                )}
                <RadioOption label="New end date" value="customEnd" />
              </RadioGroupFieldset>

              {extendMode === "weeks" || extendMode === "months" ? (
                <div className="flex flex-col gap-1.5">
                  <Input
                    id={termFieldId}
                    inputMode="numeric"
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (nextValue === "" || isValidIntegerInput(nextValue)) {
                        form.setValue(termFieldName, nextValue, { shouldValidate: true });
                      }
                    }}
                    value={termFieldValue}
                  />
                  {termFieldError ? (
                    <p className="text-xs text-destructive">{termFieldError.message}</p>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Input
                    id="extend-lease-end-date"
                    min={getMinNewLeaseEndDate(lease.leaseEndDate)}
                    onChange={(event) =>
                      form.setValue("newLeaseEndDate", event.target.value, {
                        shouldValidate: true,
                      })
                    }
                    type="date"
                    value={newLeaseEndDateValue}
                  />
                  {errors.newLeaseEndDate ? (
                    <p className="text-xs text-destructive">{errors.newLeaseEndDate.message}</p>
                  ) : null}
                </div>
              )}

              {newLeaseEndDate && extendMode !== "customEnd" ? (
                <p className="text-muted-foreground text-sm">
                  New lease end:{" "}
                  <span className="text-foreground font-medium">
                    {new Date(`${newLeaseEndDate}T00:00:00`).toLocaleDateString()}
                  </span>
                </p>
              ) : null}

              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="changeRent"
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      id="extend-lease-change-rent"
                      onCheckedChange={(checked) => {
                        const nextChecked = checked === true;
                        field.onChange(nextChecked);
                        if (nextChecked) {
                          form.setValue("rentEffectiveFromPeriod", defaultEffectivePeriod);
                          form.setValue("topUpSecurityDeposit", true);
                          if (form.getValues("newRentAmount").trim() === "") {
                            form.setValue("newRentAmount", String(getLeaseRentAmount(lease)));
                          }
                        }
                      }}
                    />
                  )}
                />
                <Label className="font-normal" htmlFor="extend-lease-change-rent">
                  {changeRentLabel}
                </Label>
              </div>

              {changeRent ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="extend-lease-rent">{newRentLabel}</Label>
                    <Input
                      id="extend-lease-rent"
                      inputMode="decimal"
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === "" || isValidDecimalInput(nextValue)) {
                          form.setValue("newRentAmount", nextValue, { shouldValidate: true });
                        }
                      }}
                      value={newRentAmountValue}
                    />
                    {errors.newRentAmount ? (
                      <p className="text-xs text-destructive">{errors.newRentAmount.message}</p>
                    ) : null}
                  </div>

                  <FormSelectField
                    id="extend-lease-effective-period"
                    label="Rent effective from"
                    onChange={(event) =>
                      form.setValue("rentEffectiveFromPeriod", event.target.value, {
                        shouldValidate: true,
                      })
                    }
                    options={effectivePeriodOptions.map((periodKey) => ({
                      label: formatRentPeriodLabel(periodKey),
                      value: periodKey,
                    }))}
                    value={form.watch("rentEffectiveFromPeriod")}
                  />

                  {depositTopUpPreview ? (
                    <div className="flex items-start gap-2">
                      <Controller
                        control={form.control}
                        name="topUpSecurityDeposit"
                        render={({ field }) => (
                          <Checkbox
                            checked={field.value}
                            className="mt-0.5"
                            id="extend-lease-top-up-deposit"
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        )}
                      />
                      <div className="space-y-1">
                        <Label className="font-normal" htmlFor="extend-lease-top-up-deposit">
                          {depositTopUpPreview.label}
                        </Label>
                        <p className="text-muted-foreground text-xs">
                          {depositTopUpPreview.description}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </>
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
                {mutation.isPending ? "Extending…" : "Extend Lease"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
ExtendLeaseDialog.displayName = "ExtendLeaseDialog";
