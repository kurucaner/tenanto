import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Link } from "react-router-dom";

import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  InviteLeaseSummaryCard,
} from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

export const LeasesPage = memo(function LeasesPage() {
  const user = useAuthStore((s) => s.user);
  const leasesQuery = useQuery({
    queryFn: () => tenantPortalApi.listLeases(),
    queryKey: queryKeys.leases(),
  });

  return (
    <div className="app-surface flex min-h-svh flex-col items-center p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Your leases
          </h1>
          <p className="text-sm text-muted-foreground">Active leases linked to your account.</p>
        </div>

        {leasesQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading leases…</p>
        ) : null}

        {leasesQuery.isError ? (
          <p className="text-sm text-destructive">
            {leasesQuery.error instanceof Error
              ? leasesQuery.error.message
              : "Failed to load leases"}
          </p>
        ) : null}

        {leasesQuery.data?.leases.length === 0 ? (
          <Card className="rounded-2xl border-border/80 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">No active leases</CardTitle>
              <CardDescription>Accept a lease invitation to see it here.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild type="button" variant="outline">
                <Link to="/">Back to home</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {leasesQuery.data?.leases.map((lease) => (
          <InviteLeaseSummaryCard
            key={lease.leaseId}
            displayName={user?.name ?? "You"}
            leaseEndDate={lease.leaseEndDate}
            leaseStartDate={lease.leaseStartDate}
            propertyName={lease.propertyName}
            role={lease.role}
            unitLabel={lease.unitLabel}
          />
        ))}
      </div>
    </div>
  );
});
LeasesPage.displayName = "LeasesPage";
