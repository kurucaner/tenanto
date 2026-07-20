import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { usePropertyActiveLeases } from "@/hooks/use-property-active-leases";
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { getStartLeaseFirstMonthRentPreview } from "@/lib/lease-proration-display";
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
  startLeaseSchema,
  type TStartLeaseFormValues,
  validateStartLeaseStep,
} from "@/lib/start-lease-form-schema";
import { resolveStartLeaseLockedUnit } from "@/lib/start-lease-locked-unit";
import {
  getNextStartLeaseStep,
  getPreviousStartLeaseStep,
  type TStartLeaseStep,
} from "@/lib/start-lease-steps";
import { type IPropertyUnit, normalizeToE164, UnitRentalType } from "@/packages/shared";

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
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    watch,
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

  const guestName = watch("guestName");
  const selectedUnitId = watch("unitId");
  const termFields = watch(["leaseEndDate", "leaseStartDate", "termMode", "termMonths"]);
  const monthlyRent = watch("monthlyRent");
  const [leaseEndDateValue, leaseStartDate, termMode, termMonths] = termFields;

  const leaseEndDate = useMemo(() => {
    return resolveLeaseTermEndPreview({
      leaseEndDate: leaseEndDateValue,
      leaseStartDate,
      termMode,
      termMonths,
    });
  }, [leaseEndDateValue, leaseStartDate, termMode, termMonths]);

  const firstMonthRentPreview = useMemo(() => {
    const parsedMonthlyRent = Number(monthlyRent);
    if (
      !leaseEndDate ||
      leaseStartDate === "" ||
      !Number.isFinite(parsedMonthlyRent) ||
      parsedMonthlyRent <= 0
    ) {
      return null;
    }

    return getStartLeaseFirstMonthRentPreview({
      leaseEndDate,
      leaseStartDate,
      monthlyRent: parsedMonthlyRent,
    });
  }, [leaseEndDate, leaseStartDate, monthlyRent]);

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

  const onInvalidSubmit = useCallback(() => {
    scrollFormToFirstError(formRef.current, currentStep);
  }, [currentStep]);

  const onSubmit = handleSubmit(onValidSubmit, onInvalidSubmit);

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
        scrollFormToFirstError(formRef.current, currentStep);
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
    monthlyRent,
    mutationPending: mutation.isPending,
    onBack,
    onContinue,
    onSubmit,
    selectedUnitId,
  };
}
