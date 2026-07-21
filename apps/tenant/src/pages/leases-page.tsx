import { useMutation, useQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ActiveLeaseCard } from "@/components/portal/active-lease-card";
import { PendingInvitesBanner } from "@/components/portal/pending-invites-banner";
import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { startRentCheckoutForAmountDue } from "@/lib/start-rent-checkout";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  TenantLeaseCard,
} from "@/packages/app-ui";
import { TenantLeaseListStatus } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export const LeasesPage = memo(function LeasesPage() {
  const user = useAuthStore((s) => s.user);
  const activeLeasesQuery = useQuery({
    queryFn: () => tenantPortalApi.listLeases(TenantLeaseListStatus.ACTIVE),
    queryKey: queryKeys.leases(TenantLeaseListStatus.ACTIVE),
  });
  const pastLeasesQuery = useQuery({
    queryFn: () => tenantPortalApi.listLeases(TenantLeaseListStatus.ENDED),
    queryKey: queryKeys.leases(TenantLeaseListStatus.ENDED),
  });
  const pendingQuery = useQuery({
    queryFn: () => tenantPortalApi.listPendingInvites(),
    queryKey: queryKeys.pendingInvites(),
  });
  const rentSummaryQuery = useQuery({
    enabled: (activeLeasesQuery.data?.leases.length ?? 0) > 0,
    queryFn: () => tenantPortalApi.getRentSummary(),
    queryKey: queryKeys.rentSummary(),
  });

  const checkoutMutation = useMutation({
    mutationFn: startRentCheckoutForAmountDue,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
    },
  });

  const pendingCount = pendingQuery.data?.invites.length ?? 0;
  const activeLeases = activeLeasesQuery.data?.leases ?? [];
  const pastLeases = pastLeasesQuery.data?.leases ?? [];
  const rentSummaryByLeaseId = useMemo(
    () => new Map(rentSummaryQuery.data?.leases.map((lease) => [lease.leaseId, lease]) ?? []),
    [rentSummaryQuery.data?.leases]
  );
  const currency = rentSummaryQuery.data?.currency ?? "usd";
  const isStartingCheckout = checkoutMutation.isPending;

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Your leases
        </h1>
        <p className="text-sm text-muted-foreground">
          Active leases and past leases linked to your account.
        </p>
      </div>

      <PendingInvitesBanner pendingCount={pendingCount} />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Active leases
        </h2>

        {activeLeasesQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading active leases…</p>
        ) : null}

        {activeLeasesQuery.isError ? (
          <p className="text-sm text-destructive">
            {activeLeasesQuery.error instanceof Error
              ? activeLeasesQuery.error.message
              : "Failed to load active leases"}
          </p>
        ) : null}

        {activeLeases.length === 0 && !activeLeasesQuery.isPending ? (
          <Card className="rounded-2xl border-border/80 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">No active leases</CardTitle>
              <CardDescription>
                Accept a lease invitation to see it here. Pending invites must be accepted before
                they appear in this list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild type="button" variant="outline">
                <Link to="/invites/pending">View pending invites</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {activeLeases.map((lease) => (
          <ActiveLeaseCard
            checkoutLeaseId={checkoutMutation.variables}
            currency={currency}
            isStartingCheckout={isStartingCheckout}
            key={lease.leaseId}
            lease={lease}
            onPay={(leaseId) => checkoutMutation.mutate(leaseId)}
            rentSummaryLease={rentSummaryByLeaseId.get(lease.leaseId)}
            tenantDisplayName={user?.name}
          />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Past leases
          </h2>
          <p className="text-sm text-muted-foreground">
            Read-only archive after move-out. Contact your property manager with questions.
          </p>
        </div>

        {pastLeasesQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading past leases…</p>
        ) : null}

        {pastLeasesQuery.isError ? (
          <p className="text-sm text-destructive">
            {pastLeasesQuery.error instanceof Error
              ? pastLeasesQuery.error.message
              : "Failed to load past leases"}
          </p>
        ) : null}

        {pastLeases.length === 0 && !pastLeasesQuery.isPending ? (
          <p className="text-sm text-muted-foreground">No past leases yet.</p>
        ) : null}

        {pastLeases.map((lease) => (
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
      </section>
    </div>
  );
});
LeasesPage.displayName = "LeasesPage";
