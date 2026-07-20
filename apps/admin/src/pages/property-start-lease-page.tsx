import { useQuery } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { StartLeaseForm } from "@/components/leases/start-lease-form";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { useStartLeaseForm } from "@/hooks/use-start-lease-form";
import { unitsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { getStartLeaseBackPath, parseStartLeaseSearchParams } from "@/lib/start-lease-routes";
import { type TStartLeaseStep } from "@/lib/start-lease-steps";
import { cn } from "@/lib/utils";
import { formatPropertyUnitSelectLabel, type IPropertyUnit } from "@/packages/shared";

interface PropertyStartLeaseFormLoadedProps {
  backLabel: string;
  backPath: string;
  initialStep: TStartLeaseStep;
  lockedUnitId: string;
  onStepChange: (step: TStartLeaseStep) => void;
  onSuccess: (leaseId: string) => void;
  propertyId: string;
  stepFromUrl: boolean;
  units: IPropertyUnit[];
}

const PropertyStartLeaseFormLoaded = memo(
  ({
    backLabel,
    backPath,
    initialStep,
    lockedUnitId,
    onStepChange,
    onSuccess,
    propertyId,
    stepFromUrl,
    units,
  }: PropertyStartLeaseFormLoadedProps) => {
    const navigate = useNavigate();
    const startLeaseForm = useStartLeaseForm({
      initialStep,
      lockedUnitId,
      onStepChange,
      onSuccess,
      propertyId,
      stepFromUrl,
      units,
    });

    const { clearDraft } = startLeaseForm;

    const handleCancel = useCallback(() => {
      clearDraft();
      navigate(backPath);
    }, [backPath, clearDraft, navigate]);

    const selectedUnitLabel = useMemo(() => {
      if (startLeaseForm.lockedUnit) {
        return formatPropertyUnitSelectLabel(startLeaseForm.lockedUnit);
      }
      const selected = startLeaseForm.availableUnits.find(
        (unit) => unit.id === startLeaseForm.selectedUnitId
      );
      return selected ? formatPropertyUnitSelectLabel(selected) : null;
    }, [startLeaseForm.availableUnits, startLeaseForm.lockedUnit, startLeaseForm.selectedUnitId]);

    return (
      <>
        <Link className="text-muted-foreground mb-6 w-fit text-sm hover:underline" to={backPath}>
          ← {backLabel}
        </Link>

        <StartLeaseForm
          availableUnits={startLeaseForm.availableUnits}
          currentStep={startLeaseForm.currentStep}
          firstMonthRentPreview={startLeaseForm.firstMonthRentPreview}
          form={startLeaseForm.form}
          formRef={startLeaseForm.formRef}
          guestName={startLeaseForm.guestName}
          isActiveLeasesPending={startLeaseForm.isActiveLeasesPending}
          isContinuing={startLeaseForm.isContinuing}
          isSubmitDisabled={startLeaseForm.isSubmitDisabled}
          isSubmitting={startLeaseForm.isSubmitting}
          leaseEndDate={startLeaseForm.leaseEndDate}
          leaseStartDate={startLeaseForm.leaseStartDate}
          lockedUnit={startLeaseForm.lockedUnit}
          lockedUnitError={startLeaseForm.lockedUnitError}
          mutationPending={startLeaseForm.mutationPending}
          onBack={startLeaseForm.onBack}
          onCancel={handleCancel}
          onContinue={startLeaseForm.onContinue}
          onStepSelect={startLeaseForm.goToStep}
          onSubmit={startLeaseForm.onSubmit}
          unitLabel={selectedUnitLabel}
        />
      </>
    );
  }
);
PropertyStartLeaseFormLoaded.displayName = "PropertyStartLeaseFormLoaded";

export const PropertyStartLeasePage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { from, step: urlStep, unitId: unitIdParam } = parseStartLeaseSearchParams(searchParams);
  const back = useMemo(() => getStartLeaseBackPath(propertyId, from), [from, propertyId]);

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: queryKeys.propertyUnits(propertyId),
  });

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);

  const handleStepChange = useCallback(
    (step: TStartLeaseStep) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (step === "who") {
            next.delete("step");
          } else {
            next.set("step", step);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleSuccess = useCallback(
    (leaseId: string) => {
      navigate(`/properties/${propertyId}/leases/${leaseId}`);
    },
    [navigate, propertyId]
  );

  if (!canManage) {
    return (
      <div className="relative -m-6 flex min-h-[calc(100svh-3.5rem)] flex-col md:-m-8">
        <div className="space-y-4 px-6 py-6 md:px-8">
          <Link className="text-muted-foreground text-sm hover:underline" to={back.path}>
            ← {back.label}
          </Link>
          <p className="text-muted-foreground text-sm">
            You do not have permission to start leases.
          </p>
        </div>
      </div>
    );
  }

  if (unitsQuery.isPending) {
    return (
      <div className="relative -m-6 flex min-h-[calc(100svh-3.5rem)] flex-col md:-m-8">
        <div className="max-w-xl space-y-4 px-6 py-6 md:px-8">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (unitsQuery.isError) {
    return (
      <div className="relative -m-6 flex min-h-[calc(100svh-3.5rem)] flex-col md:-m-8">
        <div className="space-y-4 px-6 py-6 md:px-8">
          <Link className="text-muted-foreground text-sm hover:underline" to={back.path}>
            ← {back.label}
          </Link>
          <p className="text-destructive text-sm">
            {unitsQuery.error instanceof Error ? unitsQuery.error.message : "Failed to load units."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative -m-6 flex min-h-[calc(100svh-3.5rem-4rem)] flex-col md:-m-8 md:min-h-[calc(100svh-3.5rem)]"
      )}
    >
      <div className="relative mx-auto flex w-full flex-1 flex-col px-6 py-5 md:px-8 md:py-8">
        <PropertyStartLeaseFormLoaded
          backLabel={back.label}
          backPath={back.path}
          initialStep={urlStep}
          lockedUnitId={unitIdParam}
          onStepChange={handleStepChange}
          onSuccess={handleSuccess}
          propertyId={propertyId}
          stepFromUrl={searchParams.has("step")}
          units={units}
        />
      </div>
    </div>
  );
});
PropertyStartLeasePage.displayName = "PropertyStartLeasePage";
