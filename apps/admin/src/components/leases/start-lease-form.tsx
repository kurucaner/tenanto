import { memo, type RefObject } from "react";
import { Controller, type FieldErrors, type UseFormReturn } from "react-hook-form";

import { LeaseTermEndFields } from "@/components/leases/lease-term-end-fields";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { formatIsoDateDisplay } from "@/lib/format-iso-date";
import { type TStartLeaseFormValues } from "@/lib/start-lease-form-schema";
import {
  canNavigateToStartLeaseStep,
  START_LEASE_STEP_LABELS,
  START_LEASE_STEP_SUBTITLES,
  START_LEASE_STEP_TITLES,
  START_LEASE_STEPS,
  type TStartLeaseStep,
} from "@/lib/start-lease-steps";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/packages/app-ui";
import { formatPropertyUnitSelectLabel, type IPropertyUnit } from "@/packages/shared";

export const START_LEASE_FORM_ID = "start-lease-form";

interface StartLeaseProgressProps {
  currentStep: TStartLeaseStep;
  onStepSelect: (step: TStartLeaseStep) => void;
}

const StartLeaseProgress = memo(({ currentStep, onStepSelect }: StartLeaseProgressProps) => (
  <nav aria-label="Start lease steps" className="flex flex-wrap items-center gap-x-2 gap-y-1">
    {START_LEASE_STEPS.map((step, index) => {
      const isActive = step === currentStep;
      const canNavigate = canNavigateToStartLeaseStep(step, currentStep);
      let stepButtonClass = "text-muted-foreground/50 cursor-default";
      if (isActive) {
        stepButtonClass = "font-medium text-foreground";
      } else if (canNavigate) {
        stepButtonClass = "text-muted-foreground hover:text-foreground";
      }
      return (
        <div className="flex items-center gap-2" key={step}>
          {index > 0 ? <span className="text-muted-foreground/50 text-xs">·</span> : null}
          <button
            className={cn("text-sm transition-colors", stepButtonClass)}
            disabled={!canNavigate || isActive}
            onClick={() => onStepSelect(step)}
            type="button"
          >
            {START_LEASE_STEP_LABELS[step]}
          </button>
        </div>
      );
    })}
  </nav>
));
StartLeaseProgress.displayName = "StartLeaseProgress";

interface WhoStepProps {
  availableUnits: IPropertyUnit[];
  errors: FieldErrors<TStartLeaseFormValues>;
  form: UseFormReturn<TStartLeaseFormValues>;
  isActiveLeasesPending: boolean;
  lockedUnit: IPropertyUnit | null;
  lockedUnitError: string | null;
}

const WhoStep = memo(
  ({
    availableUnits,
    errors,
    form,
    isActiveLeasesPending,
    lockedUnit,
    lockedUnitError,
  }: WhoStepProps) => (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Unit</p>
        {lockedUnit ? (
          <>
            <input type="hidden" {...form.register("unitId")} />
            <p className="text-sm font-medium">{formatPropertyUnitSelectLabel(lockedUnit)}</p>
            {lockedUnitError ? <p className="text-destructive text-sm">{lockedUnitError}</p> : null}
          </>
        ) : (
          <>
            <FormSelectField
              disabled={isActiveLeasesPending}
              error={errors.unitId?.message}
              id="start-lease-unit"
              label="Unit"
              {...form.register("unitId")}
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
      </div>

      <div className="border-border/60 border-t" />

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Primary tenant
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
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
          <div className="flex flex-col gap-1.5">
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
          </div>
        </div>
      </div>
    </div>
  )
);
WhoStep.displayName = "WhoStep";

interface TermStepProps {
  errors: FieldErrors<TStartLeaseFormValues>;
  form: UseFormReturn<TStartLeaseFormValues>;
}

const TermStep = memo(({ errors, form }: TermStepProps) => (
  <LeaseTermEndFields<TStartLeaseFormValues>
    control={form.control}
    endDateFieldId="start-lease-end-date"
    errors={errors}
    register={form.register}
    startDateFieldId="start-lease-start-date"
    termMonthsFieldId="start-lease-term-months"
  />
));
TermStep.displayName = "TermStep";

interface RentStepProps {
  errors: FieldErrors<TStartLeaseFormValues>;
  firstMonthRentPreview: string | null;
  form: UseFormReturn<TStartLeaseFormValues>;
  guestName: string;
  leaseEndDate: string | null;
  leaseStartDate: string;
  unitLabel: string | null;
}

const RentStep = memo(
  ({
    errors,
    firstMonthRentPreview,
    form,
    guestName,
    leaseEndDate,
    leaseStartDate,
    unitLabel,
  }: RentStepProps) => (
    <div className="space-y-6">
      <div className="text-muted-foreground space-y-1 text-sm">
        <p>
          <span className="text-foreground font-medium">{guestName.trim() || "Tenant"}</span>
          {unitLabel ? ` · ${unitLabel}` : null}
        </p>
        <p>
          {leaseStartDate ? formatIsoDateDisplay(leaseStartDate) : "—"}
          {" → "}
          {leaseEndDate ? formatIsoDateDisplay(leaseEndDate) : "—"}
        </p>
      </div>

      <div className="border-border/60 border-t" />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-lease-monthly-rent">Monthly rent</Label>
        <div className="relative max-w-xs">
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
            $
          </span>
          <Controller
            control={form.control}
            name="monthlyRent"
            render={({ field }) => (
              <Input
                autoFocus
                className="pl-7 tabular-nums"
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
        </div>
        {errors.monthlyRent ? (
          <p className="text-destructive text-xs">{errors.monthlyRent.message}</p>
        ) : null}
        {firstMonthRentPreview ? (
          <p className="text-sm font-medium">{firstMonthRentPreview}</p>
        ) : null}
      </div>
    </div>
  )
);
RentStep.displayName = "RentStep";

interface StartLeaseFormProps {
  availableUnits: IPropertyUnit[];
  currentStep: TStartLeaseStep;
  firstMonthRentPreview: string | null;
  form: UseFormReturn<TStartLeaseFormValues>;
  formRef: RefObject<HTMLFormElement | null>;
  guestName: string;
  isActiveLeasesPending: boolean;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  leaseEndDate: string | null;
  leaseStartDate: string;
  lockedUnit: IPropertyUnit | null;
  lockedUnitError: string | null;
  mutationPending: boolean;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onStepSelect: (step: TStartLeaseStep) => void;
  onSubmit: ReturnType<UseFormReturn<TStartLeaseFormValues>["handleSubmit"]>;
  unitLabel: string | null;
}

export const StartLeaseForm = memo(
  ({
    availableUnits,
    currentStep,
    firstMonthRentPreview,
    form,
    formRef,
    guestName,
    isActiveLeasesPending,
    isSubmitDisabled,
    isSubmitting,
    leaseEndDate,
    leaseStartDate,
    lockedUnit,
    lockedUnitError,
    mutationPending,
    onBack,
    onCancel,
    onContinue,
    onStepSelect,
    onSubmit,
    unitLabel,
  }: StartLeaseFormProps) => {
    const { errors } = form.formState;
    const isFirstStep = currentStep === "who";
    const isLastStep = currentStep === "rent";
    const submitDisabled = mutationPending || isSubmitDisabled || isSubmitting;

    return (
      <form
        className="flex min-h-0 flex-1 flex-col"
        id={START_LEASE_FORM_ID}
        onSubmit={onSubmit}
        ref={formRef}
      >
        <div className="flex-1 space-y-8 px-1 pb-28 pt-2 md:pb-8 max-w-xl mx-auto">
          <StartLeaseProgress currentStep={currentStep} onStepSelect={onStepSelect} />

          <div
            className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            key={currentStep}
          >
            <div className="space-y-1">
              <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                {START_LEASE_STEP_TITLES[currentStep]}
              </h2>
              <p className="text-muted-foreground text-sm">
                {START_LEASE_STEP_SUBTITLES[currentStep]}
              </p>
            </div>

            {currentStep === "who" ? (
              <WhoStep
                availableUnits={availableUnits}
                errors={errors}
                form={form}
                isActiveLeasesPending={isActiveLeasesPending}
                lockedUnit={lockedUnit}
                lockedUnitError={lockedUnitError}
              />
            ) : null}

            {currentStep === "term" ? <TermStep errors={errors} form={form} /> : null}

            {currentStep === "rent" ? (
              <RentStep
                errors={errors}
                firstMonthRentPreview={firstMonthRentPreview}
                form={form}
                guestName={guestName}
                leaseEndDate={leaseEndDate}
                leaseStartDate={leaseStartDate}
                unitLabel={unitLabel}
              />
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-1 py-3">
          <Button disabled={mutationPending} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2">
            {!isFirstStep ? (
              <Button disabled={mutationPending} onClick={onBack} type="button" variant="outline">
                Back
              </Button>
            ) : null}
            {isLastStep ? (
              <Button disabled={submitDisabled} type="submit">
                {mutationPending ? "Starting…" : "Start Lease"}
              </Button>
            ) : (
              <Button
                disabled={mutationPending || isSubmitDisabled}
                onClick={onContinue}
                type="button"
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </form>
    );
  }
);
StartLeaseForm.displayName = "StartLeaseForm";
