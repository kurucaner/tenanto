import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Mail } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { HomeWorkspaceHub } from "@/components/home/home-workspace-hub";
import { Button } from "@/components/ui/button";
import { propertyInvitesApi } from "@/lib/api-client";
import { getAcceptInvitePathByInviteId } from "@/lib/invite-return-url";
import { queryKeys } from "@/lib/query-keys";

const HomePendingPropertyInvitesBanner = memo(function HomePendingPropertyInvitesBanner() {
  const pendingQuery = useQuery({
    queryFn: () => propertyInvitesApi.listPendingInvites(),
    queryKey: queryKeys.pendingMemberInvites(),
  });

  const invites = pendingQuery.data?.invites ?? [];
  if (pendingQuery.isPending || pendingQuery.isError || invites.length === 0) {
    return null;
  }

  const inviteCountLabel =
    invites.length === 1 ? "1 property invitation" : `${invites.length} property invitations`;
  const firstInvite = invites[0];
  if (!firstInvite) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 rounded-lg border border-border/80 border-l-2 border-l-primary/35 bg-card/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Pending invitations</p>
          <p className="text-muted-foreground text-xs">
            You have {inviteCountLabel} waiting for your response.
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0 gap-1.5" size="sm" variant="secondary">
        <Link to={getAcceptInvitePathByInviteId(firstInvite.inviteId)}>
          Review
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
});
HomePendingPropertyInvitesBanner.displayName = "HomePendingPropertyInvitesBanner";

const HomePageInner = memo(() => (
  <AdminPageLayout gap={6}>
    <HomePendingPropertyInvitesBanner />
    <HomeWorkspaceHub />
  </AdminPageLayout>
));
HomePageInner.displayName = "HomePageInner";

export const HomePage = HomePageInner;
