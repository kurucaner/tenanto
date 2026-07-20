import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Controller, type FieldErrors, useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  buildLeaseTermApiPayload,
  LeaseTermEndFields,
  refineLeaseTermEndFormValues,
  resolveLeaseTermEndPreview,
} from "@/components/leases/lease-term-end-fields";
import { tenantPhoneFieldSchema } from "@/components/leases/tenant-contact-form-schema";
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
import { usePropertyActiveLeases } from "@/hooks/use-property-active-leases";
import { longStaysApi } from "@/lib/api-client";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { getStartLeaseFirstMonthRentPreview } from "@/lib/lease-proration-display";
import { requiredPositiveMoneyField } from "@/lib/money-field-validation";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import { createPersonNameSchema, PhoneInput } from "@/packages/app-ui";
import { type IPropertyUnit, normalizeToE164, UnitRentalType } from "@/packages/shared";

const DEFAULT_TERM_MONTHS = "12";

const startLeaseSchema = z
  .object({
    guestName: createPersonNameSchema({ requiredMessage: "Primary tenant name is required" }),
    leaseEndDate: z.string(),
    leaseStartDate: z.string().min(1, "Lease start date is required"),
    monthlyRent: requiredPositiveMoneyField("Monthly rent"),
    tenantEmail: z.string(),
    tenantPhone: tenantPhoneFieldSchema,
    termMode: z.enum(["months", "customEnd"]),
    termMonths: z.string(),
    unitId: z.string().min(1, "Unit is required"),
  })
  .superRefine((values, ctx) => {
    refineLeaseTermEndFormValues(values, ctx);
  });

type TStartLeaseFormValues = z.infer<typeof startLeaseSchema>;

function getDefaultValues(unitId?: string): TStartLeaseFormValues {
  return {
    guestName: "",
    leaseEndDate: "",
    leaseStartDate: getTodayLocalIsoDate(),
    monthlyRent: "",
    tenantEmail: "",
    tenantPhone: "",
    termMode: "months",
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

interface StartLeaseUnitSelectFieldProps {
  availableUnits: IPropertyUnit[];
  errorMessage: string | undefined;
  isActiveLeasesPending: boolean;
  register: UseFormReturn<TStartLeaseFormValues>["register"];
}

const StartLeaseUnitSelectField = memo(
  ({
    availableUnits,
    errorMessage,
    isActiveLeasesPending,
    register,
  }: StartLeaseUnitSelectFieldProps) => (
    <>
      <FormSelectField
        disabled={isActiveLeasesPending}
        error={errorMessage}
        id="start-lease-unit"
        label="Unit"
        {...register("unitId")}
      >
        <option value="">{isActiveLeasesPending ? "Loading units…" : "Select unit…"}</option>
        <PropertyUnitSelectOptions units={availableUnits} />
      </FormSelectField>
      {isActiveLeasesPending ? (
        <p className="text-muted-foreground text-xs">Loading available units…</p>
      ) : null}
      {!isActiveLeasesPending && availableUnits.length === 0 ? (
        <p className="text-muted-foreground text-xs">No vacant long-term units available.</p>
      ) : null}
    </>
  )
);
StartLeaseUnitSelectField.displayName = "StartLeaseUnitSelectField";

interface StartLeaseDialogFormProps {
  availableUnits: IPropertyUnit[];
  errors: FieldErrors<TStartLeaseFormValues>;
  firstMonthRentPreview: string | null;
  form: UseFormReturn<TStartLeaseFormValues>;
  isActiveLeasesPending: boolean;
  isSubmitting: boolean;
  leaseEndDate: string | null;
  lockedUnit: IPropertyUnit | null;
  mutationPending: boolean;
  onCancel: () => void;
  onSubmit: ReturnType<UseFormReturn<TStartLeaseFormValues>["handleSubmit"]>;
}

const StartLeaseDialogForm = memo(
  ({
    availableUnits,
    errors,
    firstMonthRentPreview,
    form,
    isActiveLeasesPending,
    isSubmitting,
    leaseEndDate,
    lockedUnit,
    mutationPending,
    onCancel,
    onSubmit,
  }: StartLeaseDialogFormProps) => (
    <form onSubmit={onSubmit}>
      <DialogFormFields>
        {!lockedUnit ? (
          <StartLeaseUnitSelectField
            availableUnits={availableUnits}
            errorMessage={errors.unitId?.message}
            isActiveLeasesPending={isActiveLeasesPending}
            register={form.register}
          />
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

        <LeaseTermEndFields<TStartLeaseFormValues>
          control={form.control}
          endDateFieldId="start-lease-end-date"
          errors={errors}
          register={form.register}
          startDateFieldId="start-lease-start-date"
          termMonthsFieldId="start-lease-term-months"
        />

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

        {firstMonthRentPreview ? (
          <p className="text-sm font-medium">{firstMonthRentPreview}</p>
        ) : null}
      </DialogFormFields>

      <DialogFooter>
        <Button disabled={mutationPending} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button disabled={mutationPending || isSubmitting} type="submit">
          {mutationPending ? "Starting…" : "Start Lease"}
        </Button>
      </DialogFooter>
    </form>
  )
);
StartLeaseDialogForm.displayName = "StartLeaseDialogForm";

export const StartLeaseDialog = memo(
  ({ onOpenChange, open, propertyId, unit, units = [] }: StartLeaseDialogProps) => {
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
        parsedMonthlyRent <= 0
      ) {
        return null;
      }

      return getStartLeaseFirstMonthRentPreview({
        leaseEndDate: resolvedEnd,
        leaseStartDate,
        monthlyRent: parsedMonthlyRent,
      });
    }, [monthlyRent, termFields]);

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
          guestName: values.guestName,
          ...buildLeaseTermApiPayload(values),
          monthlyRent: Number(values.monthlyRent),
          tenantEmail: values.tenantEmail.trim() || undefined,
          tenantPhone: normalizeToE164(values.tenantPhone.trim()) ?? undefined,
          unitId: values.unitId,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to start lease");
      },
      onSuccess: (data) => {
        if (data.portalInvite?.emailSent) {
          toast.success(
            `Lease started. Portal invite sent to ${data.portalInvite.membership.inviteEmail}`
          );
        } else if (data.portalInvite && !data.portalInvite.emailSent) {
          toast.warning(
            `Lease started but portal invite email failed to send: ${data.portalInvite.emailError ?? "Unknown error"}`
          );
        } else {
          toast.success("Lease started");
        }
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

          <StartLeaseDialogForm
            availableUnits={availableUnits}
            errors={errors}
            firstMonthRentPreview={firstMonthRentPreview}
            form={form}
            isActiveLeasesPending={isActiveLeasesPending}
            isSubmitting={isSubmitting}
            leaseEndDate={leaseEndDate}
            lockedUnit={lockedUnit}
            mutationPending={mutation.isPending}
            onCancel={() => handleOpenChange(false)}
            onSubmit={onSubmit}
          />
        </DialogContent>
      </Dialog>
    );
  }
);
StartLeaseDialog.displayName = "StartLeaseDialog";
