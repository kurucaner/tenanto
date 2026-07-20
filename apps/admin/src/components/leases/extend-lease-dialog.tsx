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
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { requiredPositiveMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  getExtensionRentEffectiveMonthOptions,
  getFirstExtensionMonth,
  type IExtendPropertyLongStayBody,
  type IPropertyLongStay,
  type LeaseExtendInputMode,
  MAX_ADDITIONAL_TERM_MONTHS,
  resolveExtendLeaseEndDate,
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
    extendMode: "months" as LeaseExtendInputMode,
    newLeaseEndDate: "",
    newMonthlyRent: "",
    rentEffectiveFromMonth: getFirstExtensionMonth(lease.leaseEndDate),
  };
}

type TExtendLeaseFormValues = ReturnType<typeof getDefaultValues>;

function buildExtendLeaseApiPayload(values: TExtendLeaseFormValues): IExtendPropertyLongStayBody {
  if (values.extendMode === "customEnd") {
    return { newLeaseEndDate: values.newLeaseEndDate };
  }

  return { additionalTermMonths: Number.parseInt(values.additionalTermMonths, 10) };
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

    const form = useForm<TExtendLeaseFormValues>({
      defaultValues: getDefaultValues(lease),
      resolver: zodResolver(
        z
          .object({
            additionalTermMonths: z.string(),
            changeRent: z.boolean(),
            extendMode: z.enum(["months", "customEnd"]),
            newLeaseEndDate: z.string(),
            newMonthlyRent: z.string(),
            rentEffectiveFromMonth: z.string(),
          })
          .superRefine((values, ctx) => {
            const body: IExtendPropertyLongStayBody = {
              ...buildExtendLeaseApiPayload(values),
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
                path: [
                  values.extendMode === "customEnd" ? "newLeaseEndDate" : "additionalTermMonths",
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
            } else if (values.newLeaseEndDate === "") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "New lease end date is required",
                path: ["newLeaseEndDate"],
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

    const extendMode = form.watch("extendMode");
    const additionalTermMonths = form.watch("additionalTermMonths");
    const newLeaseEndDateValue = form.watch("newLeaseEndDate");
    const changeRent = form.watch("changeRent");

    const extendBody = useMemo(
      () =>
        buildExtendLeaseApiPayload({
          additionalTermMonths,
          changeRent,
          extendMode,
          newLeaseEndDate: newLeaseEndDateValue,
          newMonthlyRent: "",
          rentEffectiveFromMonth: "",
        }),
      [additionalTermMonths, changeRent, extendMode, newLeaseEndDateValue]
    );

    const newLeaseEndDate = useMemo(() => {
      try {
        return resolveExtendLeaseEndDate(lease, extendBody).newLeaseEndDate;
      } catch {
        return null;
      }
    }, [extendBody, lease]);

    const effectiveMonthOptions = useMemo(() => {
      if (!newLeaseEndDate) {
        return [];
      }
      return getExtensionRentEffectiveMonthOptions(lease.leaseEndDate, newLeaseEndDate);
    }, [lease.leaseEndDate, newLeaseEndDate]);

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
        const body: IExtendPropertyLongStayBody = {
          ...buildExtendLeaseApiPayload(values),
          ...(values.changeRent
            ? {
                newMonthlyRent: Number(values.newMonthlyRent),
                rentEffectiveFromMonth: values.rentEffectiveFromMonth,
              }
            : {}),
        };
        return longStaysApi.extend(propertyId, lease.id, body);
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
              Extend {lease.guestName}&apos;s lease from the current contract end. You can
              optionally set a new monthly rent for the extension period.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <DialogFormFields>
              <RadioGroupFieldset
                legend="Extension length"
                onValueChange={(value) =>
                  form.setValue("extendMode", value as LeaseExtendInputMode)
                }
                value={extendMode}
              >
                <RadioOption label="Additional months" value="months">
                  <div className="flex flex-col gap-1.5 pl-6">
                    <Input
                      disabled={extendMode !== "months"}
                      id="extend-lease-term"
                      inputMode="numeric"
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === "" || isValidIntegerInput(nextValue)) {
                          form.setValue("additionalTermMonths", nextValue, {
                            shouldValidate: true,
                          });
                        }
                      }}
                      value={additionalTermMonths}
                    />
                    {errors.additionalTermMonths ? (
                      <p className="text-xs text-destructive">
                        {errors.additionalTermMonths.message}
                      </p>
                    ) : null}
                  </div>
                </RadioOption>
                <RadioOption label="New end date" value="customEnd">
                  <div className="flex flex-col gap-1.5 pl-6">
                    <Input
                      disabled={extendMode !== "customEnd"}
                      id="extend-lease-end-date"
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
                </RadioOption>
              </RadioGroupFieldset>

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

                  <FormSelectField
                    id="extend-lease-effective-month"
                    label="Rent effective from"
                    onChange={(event) =>
                      form.setValue("rentEffectiveFromMonth", event.target.value, {
                        shouldValidate: true,
                      })
                    }
                    options={effectiveMonthOptions.map((month) => ({
                      label: formatMonthLabel(month),
                      value: month,
                    }))}
                    value={form.watch("rentEffectiveFromMonth")}
                  />
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
