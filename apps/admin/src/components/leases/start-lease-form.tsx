import { ChevronRight } from "lucide-react";
import { memo, type RefObject } from "react";
import { Controller, type FieldErrors, type UseFormReturn, useWatch } from "react-hook-form";

import { LeaseDepositPresetFields } from "@/components/leases/lease-deposit-preset-fields";
import { LeaseTermEndFields } from "@/components/leases/lease-term-end-fields";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { formatIsoDateDisplay } from "@/lib/format-iso-date";
import { type TStartLeaseFormValues } from "@/lib/start-lease-form-schema";
import {
  getStartLeaseRentAmountLabel,
  getStartLeaseRentBillingHelperText,
  START_LEASE_RENT_BILLING_LABELS,
} from "@/lib/start-lease-rent-billing";
import {
  canNavigateToStartLeaseStep,
  START_LEASE_STEP_LABELS,
  START_LEASE_STEP_SUBTITLES,
  START_LEASE_STEPS,
  type TStartLeaseStep,
} from "@/lib/start-lease-steps";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/packages/app-ui";
import {
  formatPropertyUnitSelectLabel,
  type IPropertyUnit,
  RENT_BILLING_CADENCE_VALUES,
} from "@/packages/shared";

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
        stepButtonClass = "cursor-default font-medium text-foreground";
      } else if (canNavigate) {
        stepButtonClass = "cursor-pointer text-muted-foreground hover:text-foreground";
      }
      return (
        <div className="flex items-center gap-2" key={step}>
          {index > 0 ? (
            <ChevronRight aria-hidden className="text-muted-foreground/50 size-3.5 shrink-0" />
          ) : null}
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
  autoFocusName: boolean;
  availableUnits: IPropertyUnit[];
  form: UseFormReturn<TStartLeaseFormValues>;
  guestNameError?: string;
  isActiveLeasesPending: boolean;
  lockedUnit: IPropertyUnit | null;
  lockedUnitError: string | null;
  tenantPhoneError?: string;
  unitIdError?: string;
}

const WhoStep = memo(
  ({
    autoFocusName,
    availableUnits,
    form,
    guestNameError,
    isActiveLeasesPending,
    lockedUnit,
    lockedUnitError,
    tenantPhoneError,
    unitIdError,
  }: WhoStepProps) => (
    <div className="space-y-6">
      <div className="space-y-3">
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
              error={unitIdError}
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

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="start-lease-tenant-name">Name</Label>
            <Input
              autoFocus={autoFocusName}
              id="start-lease-tenant-name"
              {...form.register("guestName")}
            />
            {guestNameError ? <p className="text-destructive text-xs">{guestNameError}</p> : null}
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
            {tenantPhoneError ? (
              <p className="text-destructive text-xs">{tenantPhoneError}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
);
WhoStep.displayName = "WhoStep";

interface TermStepProps {
  form: UseFormReturn<TStartLeaseFormValues>;
  leaseEndDate: string | null;
  leaseEndDateError?: string;
  leaseStartDateError?: string;
  termMonthsError?: string;
  termWeeksError?: string;
}

const TermStep = memo(
  ({
    form,
    leaseEndDate,
    leaseEndDateError,
    leaseStartDateError,
    termMonthsError,
    termWeeksError,
  }: TermStepProps) => {
    const rentBillingCadence = useWatch({ control: form.control, name: "rentBillingCadence" });

    return (
      <LeaseTermEndFields<TStartLeaseFormValues>
        control={form.control}
        endDateFieldId="start-lease-end-date"
        leaseEndDateError={leaseEndDateError}
        leaseStartDateError={leaseStartDateError}
        register={form.register}
        rentBillingCadence={rentBillingCadence}
        resolvedEndDate={leaseEndDate}
        startDateFieldId="start-lease-start-date"
        termMonthsError={termMonthsError}
        termMonthsFieldId="start-lease-term-months"
        termWeeksError={termWeeksError}
        termWeeksFieldId="start-lease-term-weeks"
      />
    );
  }
);
TermStep.displayName = "TermStep";

interface RentStepProps {
  autoFocusRent: boolean;
  firstMonthRentPreview: string | null;
  form: UseFormReturn<TStartLeaseFormValues>;
  guestName: string;
  leaseEndDate: string | null;
  leaseStartDate: string;
  rentAmountError?: string;
  securityDepositCustomAmountError?: string;
  unitLabel: string | null;
}

const RentStep = memo(
  ({
    autoFocusRent,
    firstMonthRentPreview,
    form,
    guestName,
    leaseEndDate,
    leaseStartDate,
    rentAmountError,
    securityDepositCustomAmountError,
    unitLabel,
  }: RentStepProps) => {
    const rentBillingCadence = useWatch({ control: form.control, name: "rentBillingCadence" });
    const rentAmountLabel = getStartLeaseRentAmountLabel(rentBillingCadence);

    return (
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

        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Rent billing
          </p>
          <Controller
            control={form.control}
            name="rentBillingCadence"
            render={({ field }) => (
              <RadioGroupFieldset
                legend="Rent billing"
                onValueChange={field.onChange}
                value={field.value}
              >
                {RENT_BILLING_CADENCE_VALUES.map((cadence) => {
                  return (
                    <RadioOption
                      key={cadence}
                      label={START_LEASE_RENT_BILLING_LABELS[cadence]}
                      value={cadence}
                    />
                  );
                })}
              </RadioGroupFieldset>
            )}
          />
          <p className="text-muted-foreground text-xs">
            {getStartLeaseRentBillingHelperText(rentBillingCadence)}
          </p>
        </div>

        <div className="border-border/60 border-t" />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start-lease-rent-amount">{rentAmountLabel}</Label>
          <div className="relative max-w-xs">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
              $
            </span>
            <Controller
              control={form.control}
              name="rentAmount"
              render={({ field }) => (
                <Input
                  autoFocus={autoFocusRent}
                  className="pl-7 tabular-nums"
                  id="start-lease-rent-amount"
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
          {rentAmountError ? <p className="text-destructive text-xs">{rentAmountError}</p> : null}
          {firstMonthRentPreview ? (
            <p className="text-sm font-medium">{firstMonthRentPreview}</p>
          ) : null}
        </div>

        <div className="border-border/60 border-t" />

        <LeaseDepositPresetFields<TStartLeaseFormValues>
          control={form.control}
          customAmountError={securityDepositCustomAmountError}
          customAmountFieldId="start-lease-deposit-custom"
        />
      </div>
    );
  }
);
RentStep.displayName = "RentStep";

interface StartLeaseFormProps {
  availableUnits: IPropertyUnit[];
  currentStep: TStartLeaseStep;
  errors: FieldErrors<TStartLeaseFormValues>;
  firstMonthRentPreview: string | null;
  form: UseFormReturn<TStartLeaseFormValues>;
  formRef: RefObject<HTMLFormElement | null>;
  guestName: string;
  isActiveLeasesPending: boolean;
  isContinuing: boolean;
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
    errors,
    firstMonthRentPreview,
    form,
    formRef,
    guestName,
    isActiveLeasesPending,
    isContinuing,
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
    const isFirstStep = currentStep === "who";
    const isLastStep = currentStep === "rent";
    const submitDisabled = mutationPending || isSubmitDisabled || isSubmitting;
    const continueDisabled = mutationPending || isSubmitDisabled || isContinuing;

    return (
      <form
        className="flex min-h-0 flex-1 flex-col"
        id={START_LEASE_FORM_ID}
        noValidate
        onSubmit={onSubmit}
        ref={formRef}
      >
        <div className="mx-auto min-h-0 w-full max-w-xl flex-1 space-y-8 overflow-y-auto pb-6">
          <StartLeaseProgress currentStep={currentStep} onStepSelect={onStepSelect} />

          <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <p className="text-muted-foreground text-sm">
              {START_LEASE_STEP_SUBTITLES[currentStep]}
            </p>

            <section
              aria-hidden={currentStep !== "who"}
              data-start-lease-step="who"
              hidden={currentStep !== "who"}
            >
              <WhoStep
                autoFocusName={currentStep === "who"}
                availableUnits={availableUnits}
                form={form}
                guestNameError={errors.guestName?.message}
                isActiveLeasesPending={isActiveLeasesPending}
                lockedUnit={lockedUnit}
                lockedUnitError={lockedUnitError}
                tenantPhoneError={errors.tenantPhone?.message}
                unitIdError={errors.unitId?.message}
              />
            </section>

            <section
              aria-hidden={currentStep !== "term"}
              data-start-lease-step="term"
              hidden={currentStep !== "term"}
            >
              <TermStep
                form={form}
                leaseEndDate={leaseEndDate}
                leaseEndDateError={errors.leaseEndDate?.message}
                leaseStartDateError={errors.leaseStartDate?.message}
                termMonthsError={errors.termMonths?.message}
                termWeeksError={errors.termWeeks?.message}
              />
            </section>

            <section
              aria-hidden={currentStep !== "rent"}
              data-start-lease-step="rent"
              hidden={currentStep !== "rent"}
            >
              <RentStep
                autoFocusRent={currentStep === "rent"}
                firstMonthRentPreview={firstMonthRentPreview}
                form={form}
                guestName={guestName}
                leaseEndDate={leaseEndDate}
                leaseStartDate={leaseStartDate}
                rentAmountError={errors.rentAmount?.message}
                securityDepositCustomAmountError={errors.securityDepositCustomAmount?.message}
                unitLabel={unitLabel}
              />
            </section>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-muted/30 -mx-6 px-6 py-4 md:-mx-8 md:px-8">
          <div className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-2">
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
                <Button
                  disabled={submitDisabled}
                  onClick={() => {
                    void onSubmit();
                  }}
                  type="button"
                >
                  {mutationPending ? "Starting…" : "Start Lease"}
                </Button>
              ) : (
                <Button disabled={continueDisabled} onClick={onContinue} type="button">
                  {isContinuing ? "Continuing…" : "Continue"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    );
  }
);
StartLeaseForm.displayName = "StartLeaseForm";
