import { useQuery } from "@tanstack/react-query";
import { memo, useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { StartLeaseForm } from "@/components/leases/start-lease-form";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { useStartLeaseForm } from "@/hooks/use-start-lease-form";
import { unitsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  getStartLeaseBackPath,
  parseStartLeaseSearchParams,
} from "@/lib/start-lease-routes";
import { formatPropertyUnitSelectLabel } from "@/packages/shared";

export const PropertyStartLeasePage = memo(() => {
  const { permissions, propertyId } = usePropertyShell();
  const canManage = permissions.canManageLedger;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { from, unitId: unitIdParam } = parseStartLeaseSearchParams(searchParams);
  const back = useMemo(() => getStartLeaseBackPath(propertyId, from), [from, propertyId]);

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: queryKeys.propertyUnits(propertyId),
  });

  const units = useMemo(() => unitsQuery.data?.units ?? [], [unitsQuery.data?.units]);

  const handleSuccess = useCallback(
    (leaseId: string) => {
      navigate(`/properties/${propertyId}/leases/${leaseId}`);
    },
    [navigate, propertyId]
  );

  const handleCancel = useCallback(() => {
    navigate(back.path);
  }, [back.path, navigate]);

  const startLeaseForm = useStartLeaseForm({
    lockedUnitId: unitIdParam,
    onSuccess: handleSuccess,
    propertyId,
    units,
  });

  if (!canManage) {
    return (
      <div className="space-y-4">
        <Link className="text-muted-foreground text-sm hover:underline" to={back.path}>
          ← {back.label}
        </Link>
        <p className="text-muted-foreground text-sm">You do not have permission to start leases.</p>
      </div>
    );
  }

  if (unitsQuery.isPending) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (unitsQuery.isError) {
    return (
      <div className="space-y-4">
        <Link className="text-muted-foreground text-sm hover:underline" to={back.path}>
          ← {back.label}
        </Link>
        <p className="text-destructive text-sm">
          {unitsQuery.error instanceof Error ? unitsQuery.error.message : "Failed to load units."}
        </p>
      </div>
    );
  }

  const subtitle =
    startLeaseForm.lockedUnit && !startLeaseForm.lockedUnitError
      ? `Unit ${formatPropertyUnitSelectLabel(startLeaseForm.lockedUnit)}`
      : "Start a lease for a long-term unit.";

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Link className="text-muted-foreground w-fit text-sm hover:underline" to={back.path}>
          ← {back.label}
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Start lease</h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <StartLeaseForm
          availableUnits={startLeaseForm.availableUnits}
          firstMonthRentPreview={startLeaseForm.firstMonthRentPreview}
          form={startLeaseForm.form}
          formRef={startLeaseForm.formRef}
          isActiveLeasesPending={startLeaseForm.isActiveLeasesPending}
          isSubmitDisabled={startLeaseForm.isSubmitDisabled}
          isSubmitting={startLeaseForm.isSubmitting}
          leaseEndDate={startLeaseForm.leaseEndDate}
          lockedUnit={startLeaseForm.lockedUnit}
          lockedUnitError={startLeaseForm.lockedUnitError}
          mutationPending={startLeaseForm.mutationPending}
          onCancel={handleCancel}
          onSubmit={startLeaseForm.onSubmit}
        />
      </div>
    </div>
  );
});
PropertyStartLeasePage.displayName = "PropertyStartLeasePage";
