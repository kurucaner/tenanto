import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { incomeLineSelectClassName } from "@/components/income/income-line-form-options";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { isValidIntegerInput } from "@/lib/integer-input-utils";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { calculateLeaseEndDate } from "@/lib/lease-date-utils";
import { requiredPositiveMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  getExtensionRentEffectiveMonthOptions,
  getFirstExtensionMonth,
  type IPropertyLongStay,
  MAX_ADDITIONAL_TERM_MONTHS,
  validateExtendLease,
} from "@/packages/shared";

const DEFAULT_ADDITIONAL_TERM_MONTHS = "6";

function formatMonthLabel(month: string): string {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthNum = parts[1] ?? 1;
  return new Date(year, monthNum - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getDefaultValues(lease: IPropertyLongStay) {
  return {
    additionalTermMonths: DEFAULT_ADDITIONAL_TERM_MONTHS,
    changeRent: false,
    newMonthlyRent: "",
    rentEffectiveFromMonth: getFirstExtensionMonth(lease.leaseEndDate),
  };
}

type TExtendLeaseFormValues = ReturnType<typeof getDefaultValues>;

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

    const form = useForm<TExtendLeaseFormValues>({
      defaultValues: getDefaultValues(lease),
      resolver: zodResolver(
        z
          .object({
            additionalTermMonths: z
              .string()
              .min(1, "Additional term is required")
              .refine((value) => /^\d+$/.test(value), {
                message: "Additional term must be a whole number",
              })
              .refine(
                (value) => {
                  const parsed = Number.parseInt(value, 10);
                  return parsed >= 1 && parsed <= MAX_ADDITIONAL_TERM_MONTHS;
                },
                {
                  message: `Additional term must be between 1 and ${MAX_ADDITIONAL_TERM_MONTHS}`,
                }
              ),
            changeRent: z.boolean(),
            newMonthlyRent: z.string(),
            rentEffectiveFromMonth: z.string(),
          })
          .superRefine((values, ctx) => {
            const additionalTermMonths = Number.parseInt(values.additionalTermMonths, 10);
            const body = {
              additionalTermMonths,
              ...(values.changeRent
                ? {
                    newMonthlyRent: Number(values.newMonthlyRent),
                    rentEffectiveFromMonth: values.rentEffectiveFromMonth,
                  }
                : {}),
            };

            const error = validateExtendLease(body, lease, today);
            if (error) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
                path: ["additionalTermMonths"],
              });
            }

            if (values.changeRent) {
              const rentResult = requiredPositiveMoneyField("New monthly rent").safeParse(
                values.newMonthlyRent
              );
              if (!rentResult.success) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: rentResult.error.issues[0]?.message ?? "Invalid monthly rent",
                  path: ["newMonthlyRent"],
                });
              }
            }
          })
      ),
    });

    const additionalTermMonths = form.watch("additionalTermMonths");
    const changeRent = form.watch("changeRent");

    const parsedAdditionalTermMonths = Number.parseInt(additionalTermMonths, 10);

    const newLeaseEndDate = useMemo(() => {
      if (!Number.isInteger(parsedAdditionalTermMonths) || parsedAdditionalTermMonths < 1) {
        return null;
      }
      return calculateLeaseEndDate(
        lease.leaseStartDate,
        lease.termMonths + parsedAdditionalTermMonths
      );
    }, [lease.leaseStartDate, lease.termMonths, parsedAdditionalTermMonths]);

    const effectiveMonthOptions = useMemo(() => {
      if (!Number.isInteger(parsedAdditionalTermMonths) || parsedAdditionalTermMonths < 1) {
        return [];
      }
      return getExtensionRentEffectiveMonthOptions(
        lease.leaseEndDate,
        lease.leaseStartDate,
        lease.termMonths,
        parsedAdditionalTermMonths
      );
    }, [
      lease.leaseEndDate,
      lease.leaseStartDate,
      lease.termMonths,
      parsedAdditionalTermMonths,
    ]);

    const defaultEffectiveMonth = getFirstExtensionMonth(lease.leaseEndDate);

    useEffect(() => {
      if (!changeRent || effectiveMonthOptions.length === 0) {
        return;
      }
      const currentValue = form.getValues("rentEffectiveFromMonth");
      if (!effectiveMonthOptions.includes(currentValue)) {
        form.setValue("rentEffectiveFromMonth", effectiveMonthOptions[0] ?? defaultEffectiveMonth);
      }
    }, [changeRent, defaultEffectiveMonth, effectiveMonthOptions, form]);

    const mutation = useMutation({
      mutationFn: (values: TExtendLeaseFormValues) => {
        const additionalMonths = Number.parseInt(values.additionalTermMonths, 10);
        return longStaysApi.extend(propertyId, lease.id, {
          additionalTermMonths: additionalMonths,
          ...(values.changeRent
            ? {
                newMonthlyRent: Number(values.newMonthlyRent),
                rentEffectiveFromMonth: values.rentEffectiveFromMonth,
              }
            : {}),
        });
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to extend lease");
      },
      onSuccess: () => {
        toast.success("Lease extended");
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
            <DialogTitle>Extend Lease</DialogTitle>
            <DialogDescription>
              Add months to {lease.guestName}&apos;s lease. You can optionally set a new monthly
              rent for the extension period.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="extend-lease-term">Additional term (months)</Label>
                <Input
                  id="extend-lease-term"
                  inputMode="numeric"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === "" || isValidIntegerInput(nextValue)) {
                      form.setValue("additionalTermMonths", nextValue, { shouldValidate: true });
                    }
                  }}
                  value={additionalTermMonths}
                />
                {errors.additionalTermMonths ? (
                  <p className="text-xs text-destructive">{errors.additionalTermMonths.message}</p>
                ) : null}
              </div>

              {newLeaseEndDate ? (
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
                          form.setValue("rentEffectiveFromMonth", defaultEffectiveMonth);
                        }
                      }}
                    />
                  )}
                />
                <Label className="font-normal" htmlFor="extend-lease-change-rent">
                  Change monthly rent for extension
                </Label>
              </div>

              {changeRent ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="extend-lease-rent">New monthly rent</Label>
                    <Input
                      id="extend-lease-rent"
                      inputMode="decimal"
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === "" || isValidDecimalInput(nextValue)) {
                          form.setValue("newMonthlyRent", nextValue, { shouldValidate: true });
                        }
                      }}
                      value={form.watch("newMonthlyRent")}
                    />
                    {errors.newMonthlyRent ? (
                      <p className="text-xs text-destructive">{errors.newMonthlyRent.message}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="extend-lease-effective-month">Rent effective from</Label>
                    <select
                      className={incomeLineSelectClassName}
                      id="extend-lease-effective-month"
                      onChange={(event) =>
                        form.setValue("rentEffectiveFromMonth", event.target.value, {
                          shouldValidate: true,
                        })
                      }
                      value={form.watch("rentEffectiveFromMonth")}
                    >
                      {effectiveMonthOptions.map((month) => (
                        <option key={month} value={month}>
                          {formatMonthLabel(month)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}
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
