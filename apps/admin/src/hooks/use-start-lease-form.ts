import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type BaseSyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { usePropertyActiveLeases } from "@/hooks/use-property-active-leases";
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { buildLeaseTermApiPayload, resolveLeaseTermEndPreview } from "@/lib/lease-term-end-utils";
import { scrollFormToFirstError } from "@/lib/scroll-form-to-first-error";
import {
  clearStartLeaseDraft,
  getStartLeaseDraftUnitScope,
  writeStartLeaseDraft,
} from "@/lib/start-lease-draft-storage";
import { resolveStartLeaseInitialState } from "@/lib/start-lease-form-init";
import {
  applyStartLeaseStepValidationErrors,
  DEFAULT_START_LEASE_TERM_WEEKS,
  startLeaseSchema,
  type TStartLeaseFormValues,
  validateStartLeaseStep,
} from "@/lib/start-lease-form-schema";
import { resolveStartLeaseLockedUnit } from "@/lib/start-lease-locked-unit";
import {
  getStartLeaseFirstPeriodRentPreview,
  normalizeStartLeaseRentBillingCadence,
} from "@/lib/start-lease-rent-billing";
import {
  getNextStartLeaseStep,
  getPreviousStartLeaseStep,
  type TStartLeaseStep,
} from "@/lib/start-lease-steps";
import {
  deriveTermWeeksFromDates,
  type IPropertyUnit,
  normalizeToE164,
  RentBillingCadence,
  UnitRentalType,
} from "@/packages/shared";

interface UseStartLeaseFormOptions {
  initialStep?: TStartLeaseStep;
  lockedUnitId?: string;
  onStepChange: (step: TStartLeaseStep) => void;
  onSuccess: (leaseId: string) => void;
  propertyId: string;
  stepFromUrl?: boolean;
  units: IPropertyUnit[];
}

export function useStartLeaseForm({
  initialStep = "who",
  lockedUnitId = "",
  onStepChange,
  onSuccess,
  propertyId,
  stepFromUrl = false,
  units,
}: UseStartLeaseFormOptions) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement | null>(null);
  const didSyncInitialStepRef = useRef(false);
  const unitScope = getStartLeaseDraftUnitScope(lockedUnitId);
  const initialState = useMemo(
    () =>
      resolveStartLeaseInitialState({
        initialStep,
        lockedUnitId,
        propertyId,
        stepFromUrl,
      }),
    [initialStep, lockedUnitId, propertyId, stepFromUrl]
  );

  const [currentStep, setCurrentStep] = useState<TStartLeaseStep>(initialState.step);
  const [isContinuing, setIsContinuing] = useState(false);

  const { activeLeases, isPending: isActiveLeasesPending } = usePropertyActiveLeases(propertyId);

  const lockedUnitState = useMemo(
    () =>
      resolveStartLeaseLockedUnit({
        activeLeases,
        unitIdParam: lockedUnitId,
        units,
      }),
    [activeLeases, lockedUnitId, units]
  );

  const lockedUnit = lockedUnitState.unit;
  const lockedUnitError = lockedUnitState.error;

  const occupiedUnitIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lease of activeLeases) {
      ids.add(lease.unitId);
    }
    return ids;
  }, [activeLeases]);

  const form = useForm<TStartLeaseFormValues>({
    defaultValues: initialState.values,
    resolver: zodResolver(startLeaseSchema),
  });
  const {
    clearErrors,
    control,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
  } = form;

  const _setCurrentStep = useCallback(
    (step: TStartLeaseStep) => {
      setCurrentStep(step);
      onStepChange(step);
    },
    [onStepChange]
  );

  useEffect(() => {
    if (didSyncInitialStepRef.current || initialState.step === initialStep) {
      return;
    }
    didSyncInitialStepRef.current = true;
    onStepChange(initialState.step);
  }, [initialState.step, initialStep, onStepChange]);

  const flushDraft = useCallback(
    (step: TStartLeaseStep = currentStep) => {
      writeStartLeaseDraft(propertyId, unitScope, {
        step,
        values: getValues(),
      });
    },
    [currentStep, getValues, propertyId, unitScope]
  );

  const clearDraft = useCallback(() => {
    clearStartLeaseDraft(propertyId, unitScope);
  }, [propertyId, unitScope]);

  useEffect(() => {
    if (lockedUnitId) {
      form.setValue("unitId", lockedUnitId);
    }
  }, [form, lockedUnitId]);

  const [
    guestName,
    selectedUnitId,
    rentAmount,
    rentBillingCadence,
    leaseEndDateValue,
    leaseStartDate,
    termMode,
    termMonths,
    termWeeks,
  ] = useWatch({
    control,
    name: [
      "guestName",
      "unitId",
      "rentAmount",
      "rentBillingCadence",
      "leaseEndDate",
      "leaseStartDate",
      "termMode",
      "termMonths",
      "termWeeks",
    ],
  });

  useEffect(() => {
    const cadence = normalizeStartLeaseRentBillingCadence(rentBillingCadence);
    const mode = getValues("termMode");
    if (cadence === RentBillingCadence.WEEKLY && mode === "months") {
      const preview = resolveLeaseTermEndPreview({
        leaseEndDate: getValues("leaseEndDate"),
        leaseStartDate: getValues("leaseStartDate"),
        termMode: "months",
        termMonths: getValues("termMonths"),
        termWeeks: getValues("termWeeks"),
      });
      const start = getValues("leaseStartDate");
      if (preview && start) {
        form.setValue("termWeeks", String(deriveTermWeeksFromDates(start, preview)));
      } else {
        form.setValue("termWeeks", DEFAULT_START_LEASE_TERM_WEEKS);
      }
      form.setValue("termMode", "weeks");
      return;
    }

    if (cadence === RentBillingCadence.MONTHLY && mode === "weeks") {
      form.setValue("termMode", "months");
    }
  }, [form, getValues, rentBillingCadence]);

  const leaseEndDate = useMemo(() => {
    return resolveLeaseTermEndPreview({
      leaseEndDate: leaseEndDateValue,
      leaseStartDate,
      termMode,
      termMonths,
      termWeeks,
    });
  }, [leaseEndDateValue, leaseStartDate, termMode, termMonths, termWeeks]);

  const firstMonthRentPreview = useMemo(() => {
    const parsedRentAmount = Number(rentAmount);
    if (
      !leaseEndDate ||
      leaseStartDate === "" ||
      !Number.isFinite(parsedRentAmount) ||
      parsedRentAmount <= 0
    ) {
      return null;
    }

    return getStartLeaseFirstPeriodRentPreview({
      leaseEndDate,
      leaseStartDate,
      rentAmount: parsedRentAmount,
      rentBillingCadence: normalizeStartLeaseRentBillingCadence(rentBillingCadence),
    });
  }, [leaseEndDate, leaseStartDate, rentAmount, rentBillingCadence]);

  const availableUnits = useMemo(
    () =>
      units.filter(
        (item) =>
          !item.isDeleted &&
          item.rentalType === UnitRentalType.LONG_TERM &&
          !occupiedUnitIds.has(item.id)
      ),
    [occupiedUnitIds, units]
  );

  const mutation = useMutation({
    mutationFn: (values: TStartLeaseFormValues) =>
      longStaysApi.create(propertyId, {
        guestName: values.guestName,
        ...buildLeaseTermApiPayload(values),
        rentAmount: Number(values.rentAmount),
        rentBillingCadence: normalizeStartLeaseRentBillingCadence(values.rentBillingCadence),
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
      } else {
        toast.success("Lease started");
      }
      clearDraft();
      invalidatePropertyLongStayCaches(queryClient, propertyId);
      onSuccess(data.longStay.id);
    },
  });

  const isSubmitDisabled = Boolean(lockedUnitId && lockedUnitError);

  const onValidSubmit = useCallback(
    (values: TStartLeaseFormValues) => {
      mutation.mutate(values);
    },
    [mutation]
  );

  const onSubmit = useCallback(
    (event?: BaseSyntheticEvent) =>
      handleSubmit(onValidSubmit, () => {
        scrollFormToFirstError(formRef, currentStep);
      })(event),
    [currentStep, handleSubmit, onValidSubmit]
  );

  const goToStep = useCallback(
    (step: TStartLeaseStep) => {
      clearErrors();
      _setCurrentStep(step);
      flushDraft(step);
    },
    [clearErrors, flushDraft, _setCurrentStep]
  );

  const onContinue = useCallback(async () => {
    if (isContinuing) {
      return;
    }

    setIsContinuing(true);
    try {
      const values = getValues();
      const result = validateStartLeaseStep(currentStep, values);
      if (!result.success) {
        applyStartLeaseStepValidationErrors(form, currentStep, result.error);
        scrollFormToFirstError(formRef, currentStep);
        return;
      }

      const next = getNextStartLeaseStep(currentStep);
      if (!next) {
        return;
      }
      goToStep(next);
    } finally {
      setIsContinuing(false);
    }
  }, [currentStep, form, getValues, goToStep, isContinuing]);

  const onBack = useCallback(() => {
    const previous = getPreviousStartLeaseStep(currentStep);
    if (!previous) {
      return;
    }
    goToStep(previous);
  }, [currentStep, goToStep]);

  return {
    availableUnits,
    clearDraft,
    currentStep,
    errors,
    firstMonthRentPreview,
    form,
    formRef,
    goToStep,
    guestName,
    isActiveLeasesPending,
    isContinuing,
    isSubmitDisabled,
    isSubmitting,
    leaseEndDate,
    leaseStartDate,
    lockedUnit,
    lockedUnitError,
    mutationPending: mutation.isPending,
    onBack,
    onContinue,
    onSubmit,
    rentAmount,
    selectedUnitId,
  };
}
