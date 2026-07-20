import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  buildLeaseTermApiPayload,
  resolveLeaseTermEndPreview,
} from "@/components/leases/lease-term-end-fields";
import { usePropertyActiveLeases } from "@/hooks/use-property-active-leases";
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { getStartLeaseFirstMonthRentPreview } from "@/lib/lease-proration-display";
import { scrollFormToFirstError } from "@/lib/scroll-form-to-first-error";
import {
  getStartLeaseDefaultValues,
  startLeaseSchema,
  type TStartLeaseFormValues,
} from "@/lib/start-lease-form-schema";
import { resolveStartLeaseLockedUnit } from "@/lib/start-lease-locked-unit";
import { type IPropertyUnit, normalizeToE164, UnitRentalType } from "@/packages/shared";

interface UseStartLeaseFormOptions {
  lockedUnitId?: string;
  onSuccess: (leaseId: string) => void;
  propertyId: string;
  units: IPropertyUnit[];
}

export function useStartLeaseForm({
  lockedUnitId = "",
  onSuccess,
  propertyId,
  units,
}: UseStartLeaseFormOptions) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement | null>(null);

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
    defaultValues: getStartLeaseDefaultValues(lockedUnit?.id ?? lockedUnitId),
    resolver: zodResolver(startLeaseSchema),
  });

  useEffect(() => {
    const nextUnitId = lockedUnit?.id ?? lockedUnitId;
    if (nextUnitId) {
      form.setValue("unitId", nextUnitId);
    }
  }, [form, lockedUnit?.id, lockedUnitId]);

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
      } else if (data.portalInvite && !data.portalInvite.emailSent) {
        toast.warning(
          `Lease started but portal invite email failed to send: ${data.portalInvite.emailError ?? "Unknown error"}`
        );
      } else {
        toast.success("Lease started");
      }
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
    toast.error("Fix the highlighted fields");
    scrollFormToFirstError(formRef.current);
  }, []);

  const onSubmit = form.handleSubmit(onValidSubmit, onInvalidSubmit);

  return {
    availableUnits,
    firstMonthRentPreview,
    form,
    formRef,
    isActiveLeasesPending,
    isSubmitDisabled,
    isSubmitting: form.formState.isSubmitting,
    leaseEndDate,
    lockedUnit,
    lockedUnitError,
    mutationPending: mutation.isPending,
    onSubmit,
  };
}
