import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { incomeLineSelectClassName } from "@/components/income/income-line-form-options";
import { tenantPhoneFieldSchema } from "@/components/leases/tenant-contact-form-schema";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { usePropertyActiveLeases } from "@/hooks/use-property-active-leases";
import { longStaysApi } from "@/lib/api-client";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { isValidIntegerInput } from "@/lib/integer-input-utils";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { requiredPositiveMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import {
  calculateLeaseEndDate,
  type IPropertyUnit,
  normalizeToE164,
  UnitRentalType,
} from "@/packages/shared";

const DEFAULT_TERM_MONTHS = "12";
const MAX_TERM_MONTHS = 60;

const startLeaseSchema = z.object({
  guestName: z.string().trim().min(1, "Primary tenant name is required"),
  leaseStartDate: z.string().min(1, "Lease start date is required"),
  monthlyRent: requiredPositiveMoneyField("Monthly rent"),
  tenantEmail: z.string(),
  tenantPhone: tenantPhoneFieldSchema,
  termMonths: z
    .string()
    .min(1, "Term is required")
    .refine((value) => /^\d+$/.test(value), {
      message: "Term must be a whole number",
    })
    .refine(
      (value) => {
        const parsed = Number.parseInt(value, 10);
        return parsed >= 1 && parsed <= MAX_TERM_MONTHS;
      },
      { message: `Term must be between 1 and ${MAX_TERM_MONTHS}` }
    ),
  unitId: z.string().min(1, "Unit is required"),
});

type TStartLeaseFormValues = z.infer<typeof startLeaseSchema>;

function getDefaultValues(unitId?: string): TStartLeaseFormValues {
  return {
    guestName: "",
    leaseStartDate: getTodayLocalIsoDate(),
    monthlyRent: "",
    tenantEmail: "",
    tenantPhone: "",
    termMonths: DEFAULT_TERM_MONTHS,
    unitId: unitId ?? "",
  };
}

interface StartLeaseDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  unit?: IPropertyUnit | null;
  units?: IPropertyUnit[];
}

export const StartLeaseDialog = memo(
  ({
    onOpenChange,
    open,
    propertyId,
    unit,
    units = [],
  }: StartLeaseDialogProps) => {
    const queryClient = useQueryClient();
    const lockedUnit = unit ?? null;

    const { activeLeases, isPending: isActiveLeasesPending } = usePropertyActiveLeases(propertyId, {
      enabled: open && !lockedUnit,
    });

    const occupiedUnitIds = useMemo(() => {
      const ids = new Set<string>();
      for (const lease of activeLeases) {
        ids.add(lease.unitId);
      }
      return ids;
    }, [activeLeases]);

    const form = useForm<TStartLeaseFormValues>({
      defaultValues: getDefaultValues(lockedUnit?.id),
      resolver: zodResolver(startLeaseSchema),
    });

    const leaseStartDate = form.watch("leaseStartDate");
    const termMonths = form.watch("termMonths");

    const leaseEndDate = useMemo(() => {
      const parsedTermMonths = Number.parseInt(termMonths, 10);
      if (leaseStartDate === "" || !Number.isInteger(parsedTermMonths) || parsedTermMonths < 1) {
        return null;
      }
      return calculateLeaseEndDate(leaseStartDate, parsedTermMonths);
    }, [leaseStartDate, termMonths]);

    const availableUnits = useMemo(
      () =>
        units.filter(
          (item) =>
            !item.isDeleted &&
            item.rentalType === UnitRentalType.LONG_TERM &&
            !occupiedUnitIds?.has(item.id)
        ),
      [occupiedUnitIds, units]
    );

    const mutation = useMutation({
      mutationFn: (values: TStartLeaseFormValues) =>
        longStaysApi.create(propertyId, {
          guestName: values.guestName.trim(),
          leaseStartDate: values.leaseStartDate,
          monthlyRent: Number(values.monthlyRent),
          tenantEmail: values.tenantEmail.trim() || undefined,
          tenantPhone: normalizeToE164(values.tenantPhone.trim()) ?? undefined,
          termMonths: Number.parseInt(values.termMonths, 10),
          unitId: values.unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to start lease");
      },
      onSuccess: () => {
        toast.success("Lease started");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        handleOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen) {
          form.reset(getDefaultValues(lockedUnit?.id));
        }
        onOpenChange(nextOpen);
      },
      [form, lockedUnit?.id, onOpenChange]
    );

    const onSubmit = form.handleSubmit((values) => {
      mutation.mutate(values);
    });

    const { errors, isSubmitting } = form.formState;

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Start Lease</DialogTitle>
            <DialogDescription>
              {lockedUnit
                ? `Start a lease for unit ${lockedUnit.unitNumber}.`
                : "Start a lease for a long-term unit."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-5 px-6 py-5">
              {!lockedUnit ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start-lease-unit">Unit</Label>
                  <select
                    className={incomeLineSelectClassName}
                    disabled={isActiveLeasesPending}
                    id="start-lease-unit"
                    {...form.register("unitId")}
                  >
                    <option value="">
                      {isActiveLeasesPending ? "Loading units…" : "Select unit…"}
                    </option>
                    <PropertyUnitSelectOptions units={availableUnits} />
                  </select>
                  {errors.unitId ? (
                    <p className="text-xs text-destructive">{errors.unitId.message}</p>
                  ) : null}
                  {isActiveLeasesPending ? (
                    <p className="text-muted-foreground text-xs">Loading available units…</p>
                  ) : null}
                  {!isActiveLeasesPending && availableUnits.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No vacant long-term units available.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start-lease-tenant-name">Primary Tenant</Label>
                <Input autoFocus id="start-lease-tenant-name" {...form.register("guestName")} />
                {errors.guestName ? (
                  <p className="text-xs text-destructive">{errors.guestName.message}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="start-lease-email" optional>
                  Email
                </FieldLabel>
                <Input id="start-lease-email" type="email" {...form.register("tenantEmail")} />
              </div>

              <Controller
                control={form.control}
                name="tenantPhone"
                render={({ field }) => (
                  <PhoneInput
                    id="start-lease-phone"
                    onChange={field.onChange}
                    optional
                    value={field.value}
                  />
                )}
              />
              {errors.tenantPhone ? (
                <p className="text-xs text-destructive">{errors.tenantPhone.message}</p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start-lease-start-date">Lease Start Date</Label>
                  <Input
                    id="start-lease-start-date"
                    type="date"
                    {...form.register("leaseStartDate")}
                  />
                  {errors.leaseStartDate ? (
                    <p className="text-xs text-destructive">{errors.leaseStartDate.message}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start-lease-term-months">Term (Months)</Label>
                  <Controller
                    control={form.control}
                    name="termMonths"
                    render={({ field }) => (
                      <Input
                        id="start-lease-term-months"
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
                <Label htmlFor="start-lease-monthly-rent">Monthly Rent</Label>
                <Controller
                  control={form.control}
                  name="monthlyRent"
                  render={({ field }) => (
                    <Input
                      id="start-lease-monthly-rent"
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
                {mutation.isPending ? "Starting…" : "Start Lease"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
StartLeaseDialog.displayName = "StartLeaseDialog";
