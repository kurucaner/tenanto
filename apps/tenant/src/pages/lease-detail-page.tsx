import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Link, useParams } from "react-router-dom";

import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  TenantLeaseDetailSummary,
  TenantLeaseRentSchedule,
} from "@/packages/app-ui";
import { TenantMembershipStatus } from "@/packages/shared";

export const LeaseDetailPage = memo(function LeaseDetailPage() {
  const { leaseId = "" } = useParams();

  const leaseQuery = useQuery({
    enabled: leaseId.length > 0,
    queryFn: () => tenantPortalApi.getLease(leaseId),
    queryKey: queryKeys.lease(leaseId),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <Button asChild className="w-fit" type="button" variant="ghost">
          <Link to="/leases">← Back to leases</Link>
        </Button>
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Lease details
          </h1>
          <p className="text-sm text-muted-foreground">
            {leaseQuery.data?.status === TenantMembershipStatus.ENDED
              ? "Read-only archive summary after move-out."
              : "Read-only summary and rent schedule."}
          </p>
        </div>
      </div>

      {leaseQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading lease…</p>
      ) : null}

      {leaseQuery.isError ? (
        <p className="text-sm text-destructive">
          {leaseQuery.error instanceof Error ? leaseQuery.error.message : "Failed to load lease"}
        </p>
      ) : null}

      {leaseQuery.data ? (
        <>
          <TenantLeaseDetailSummary lease={leaseQuery.data} />
          {leaseQuery.data.status !== TenantMembershipStatus.ENDED ? (
            <TenantLeaseRentSchedule lease={leaseQuery.data} />
          ) : null}
        </>
      ) : null}
    </div>
  );
});
LeaseDetailPage.displayName = "LeaseDetailPage";
