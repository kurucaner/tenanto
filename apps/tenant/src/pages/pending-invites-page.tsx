import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

import { tenantPortalApi } from "@/lib/api-client";
import { invalidateTenantPortalCaches } from "@/lib/invalidate-tenant-portal-caches";
import { queryKeys } from "@/lib/query-keys";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  getAuthApiErrorMessage,
  TenantPendingInviteCard,
} from "@/packages/app-ui";

export const PendingInvitesPage = memo(function PendingInvitesPage() {
  const queryClient = useQueryClient();
  const [actingMembershipId, setActingMembershipId] = useState<string | null>(null);
  const [actingType, setActingType] = useState<"accept" | "decline" | null>(null);

  const pendingQuery = useQuery({
    queryFn: () => tenantPortalApi.listPendingInvites(),
    queryKey: queryKeys.pendingInvites(),
  });

  const handleAccept = async (membershipId: string) => {
    setActingMembershipId(membershipId);
    setActingType("accept");
    try {
      await tenantPortalApi.acceptInvite(membershipId);
      await invalidateTenantPortalCaches(queryClient);
      toast.success("Invitation accepted");
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to accept invitation"));
    } finally {
      setActingMembershipId(null);
      setActingType(null);
    }
  };

  const handleDecline = async (membershipId: string) => {
    setActingMembershipId(membershipId);
    setActingType("decline");
    try {
      await tenantPortalApi.declineInvite(membershipId);
      await invalidateTenantPortalCaches(queryClient);
      toast.success("Invitation declined");
    } catch (error) {
      toast.error(getAuthApiErrorMessage(error, "Failed to decline invitation"));
    } finally {
      setActingMembershipId(null);
      setActingType(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Pending invites
        </h1>
        <p className="text-sm text-muted-foreground">
          Accept an invitation to add a lease to your account.
        </p>
      </div>

      {pendingQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading invitations…</p>
      ) : null}

      {pendingQuery.isError ? (
        <p className="text-sm text-destructive">
          {pendingQuery.error instanceof Error
            ? pendingQuery.error.message
            : "Failed to load invitations"}
        </p>
      ) : null}

      {pendingQuery.data?.invites.length === 0 ? (
        <Card className="rounded-2xl border-border/80 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">No pending invites</CardTitle>
            <CardDescription>
              When an operator invites you to a lease, it will appear here until you accept or
              decline.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Accepted leases show up under Leases.
          </CardContent>
        </Card>
      ) : null}

      {pendingQuery.data?.invites.map((invite) => (
        <TenantPendingInviteCard
          key={invite.membershipId}
          accepting={actingMembershipId === invite.membershipId && actingType === "accept"}
          declining={actingMembershipId === invite.membershipId && actingType === "decline"}
          displayName={invite.displayName}
          expiresAt={invite.expiresAt}
          membershipId={invite.membershipId}
          onAccept={(membershipId) => void handleAccept(membershipId)}
          onDecline={(membershipId) => void handleDecline(membershipId)}
          propertyName={invite.propertyName}
          role={invite.role}
          unitLabel={invite.unitLabel}
        />
      ))}
    </div>
  );
});
PendingInvitesPage.displayName = "PendingInvitesPage";
