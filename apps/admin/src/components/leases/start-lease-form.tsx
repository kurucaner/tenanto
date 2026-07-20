import { memo, type RefObject } from "react";
import { Controller, type FieldErrors, type UseFormReturn } from "react-hook-form";

import { LeaseTermEndFields } from "@/components/leases/lease-term-end-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field-label";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { type TStartLeaseFormValues } from "@/lib/start-lease-form-schema";
import { PhoneInput } from "@/packages/app-ui";
import { formatPropertyUnitSelectLabel,type IPropertyUnit } from "@/packages/shared";

interface StartLeaseUnitSectionProps {
  availableUnits: IPropertyUnit[];
  errorMessage: string | undefined;
  isActiveLeasesPending: boolean;
  lockedUnit: IPropertyUnit | null;
  lockedUnitError: string | null;
  register: UseFormReturn<TStartLeaseFormValues>["register"];
}

const StartLeaseUnitSection = memo(
  ({
    availableUnits,
    errorMessage,
    isActiveLeasesPending,
    lockedUnit,
    lockedUnitError,
    register,
  }: StartLeaseUnitSectionProps) => (
    <Card>
      <CardHeader>
        <CardTitle>Unit</CardTitle>
        <CardDescription>
          {lockedUnit
            ? `Starting a lease for ${formatPropertyUnitSelectLabel(lockedUnit)}.`
            : "Choose a vacant long-term unit for this lease."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lockedUnit ? (
          <>
            <input type="hidden" {...register("unitId")} />
            {lockedUnitError ? (
              <p className="text-destructive text-sm">{lockedUnitError}</p>
            ) : null}
          </>
        ) : (
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
        )}
      </CardContent>
    </Card>
  )
);
StartLeaseUnitSection.displayName = "StartLeaseUnitSection";

interface StartLeaseRentSectionProps {
  errors: FieldErrors<TStartLeaseFormValues>;
  firstMonthRentPreview: string | null;
  form: UseFormReturn<TStartLeaseFormValues>;
  leaseEndDate: string | null;
}

const StartLeaseRentSection = memo(
  ({ errors, firstMonthRentPreview, form, leaseEndDate }: StartLeaseRentSectionProps) => (
    <Card>
      <CardHeader>
        <CardTitle>Rent</CardTitle>
        <CardDescription>Monthly rent and first-month proration preview.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <p className="text-destructive text-xs">{errors.monthlyRent.message}</p>
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
      </CardContent>
    </Card>
  )
);
StartLeaseRentSection.displayName = "StartLeaseRentSection";

interface StartLeaseTermSectionProps {
  errors: FieldErrors<TStartLeaseFormValues>;
  form: UseFormReturn<TStartLeaseFormValues>;
}

const StartLeaseTermSection = memo(({ errors, form }: StartLeaseTermSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle>Term</CardTitle>
      <CardDescription>Lease start date and contract length.</CardDescription>
    </CardHeader>
    <CardContent>
      <LeaseTermEndFields<TStartLeaseFormValues>
        control={form.control}
        endDateFieldId="start-lease-end-date"
        errors={errors}
        register={form.register}
        startDateFieldId="start-lease-start-date"
        termMonthsFieldId="start-lease-term-months"
      />
    </CardContent>
  </Card>
));
StartLeaseTermSection.displayName = "StartLeaseTermSection";

interface StartLeaseTenantSectionProps {
  errors: FieldErrors<TStartLeaseFormValues>;
  form: UseFormReturn<TStartLeaseFormValues>;
}

const StartLeaseTenantSection = memo(({ errors, form }: StartLeaseTenantSectionProps) => (
  <Card>
    <CardHeader>
      <CardTitle>Primary tenant</CardTitle>
      <CardDescription>Contact details for the main leaseholder.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-lease-tenant-name">Name</Label>
        <Input autoFocus id="start-lease-tenant-name" {...form.register("guestName")} />
        {errors.guestName ? (
          <p className="text-destructive text-xs">{errors.guestName.message}</p>
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
        <p className="text-destructive text-xs">{errors.tenantPhone.message}</p>
      ) : null}
    </CardContent>
  </Card>
));
StartLeaseTenantSection.displayName = "StartLeaseTenantSection";

interface StartLeaseFormProps {
  availableUnits: IPropertyUnit[];
  firstMonthRentPreview: string | null;
  form: UseFormReturn<TStartLeaseFormValues>;
  formRef: RefObject<HTMLFormElement | null>;
  isActiveLeasesPending: boolean;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  leaseEndDate: string | null;
  lockedUnit: IPropertyUnit | null;
  lockedUnitError: string | null;
  mutationPending: boolean;
  onCancel: () => void;
  onSubmit: ReturnType<UseFormReturn<TStartLeaseFormValues>["handleSubmit"]>;
}

export const StartLeaseForm = memo(
  ({
    availableUnits,
    firstMonthRentPreview,
    form,
    formRef,
    isActiveLeasesPending,
    isSubmitDisabled,
    isSubmitting,
    leaseEndDate,
    lockedUnit,
    lockedUnitError,
    mutationPending,
    onCancel,
    onSubmit,
  }: StartLeaseFormProps) => {
    const { errors } = form.formState;

    return (
      <form className="space-y-4" onSubmit={onSubmit} ref={formRef}>
        <StartLeaseUnitSection
          availableUnits={availableUnits}
          errorMessage={errors.unitId?.message}
          isActiveLeasesPending={isActiveLeasesPending}
          lockedUnit={lockedUnit}
          lockedUnitError={lockedUnitError}
          register={form.register}
        />

        <StartLeaseRentSection
          errors={errors}
          firstMonthRentPreview={firstMonthRentPreview}
          form={form}
          leaseEndDate={leaseEndDate}
        />

        <StartLeaseTermSection errors={errors} form={form} />

        <StartLeaseTenantSection errors={errors} form={form} />

        <div className="flex flex-wrap gap-2 pt-2">
          <Button disabled={mutationPending} onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={mutationPending || isSubmitDisabled || isSubmitting}
            type="submit"
          >
            {mutationPending ? "Starting…" : "Start Lease"}
          </Button>
        </div>
      </form>
    );
  }
);
StartLeaseForm.displayName = "StartLeaseForm";
