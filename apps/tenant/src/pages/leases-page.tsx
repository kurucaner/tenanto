import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Link } from "react-router-dom";

import { PendingInvitesBanner } from "@/components/portal/pending-invites-banner";
import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  TenantLeaseCard,
} from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

export const LeasesPage = memo(function LeasesPage() {
  const user = useAuthStore((s) => s.user);
  const leasesQuery = useQuery({
    queryFn: () => tenantPortalApi.listLeases(),
    queryKey: queryKeys.leases(),
  });
  const pendingQuery = useQuery({
    queryFn: () => tenantPortalApi.listPendingInvites(),
    queryKey: queryKeys.pendingInvites(),
  });

  const pendingCount = pendingQuery.data?.invites.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Your leases
        </h1>
        <p className="text-sm text-muted-foreground">Active leases linked to your account.</p>
      </div>

      <PendingInvitesBanner pendingCount={pendingCount} />

      {leasesQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading leases…</p>
      ) : null}

      {leasesQuery.isError ? (
        <p className="text-sm text-destructive">
          {leasesQuery.error instanceof Error ? leasesQuery.error.message : "Failed to load leases"}
        </p>
      ) : null}

      {leasesQuery.data?.leases.length === 0 ? (
        <Card className="rounded-2xl border-border/80 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">No active leases</CardTitle>
            <CardDescription>
              Accept a lease invitation to see it here. Pending invites must be accepted before they
              appear in this list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild type="button" variant="outline">
              <Link to="/invites/pending">View pending invites</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {leasesQuery.data?.leases.map((lease) => (
        <TenantLeaseCard
          key={lease.leaseId}
          leaseEndDate={lease.leaseEndDate}
          leaseStartDate={lease.leaseStartDate}
          propertyName={lease.propertyName}
          role={lease.role}
          status={lease.status}
          tenantDisplayName={user?.name}
          to={`/leases/${lease.leaseId}`}
          unitLabel={lease.unitLabel}
        />
      ))}
    </div>
  );
});
LeasesPage.displayName = "LeasesPage";
