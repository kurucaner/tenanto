import { useQuery } from "@tanstack/react-query";
import { ArrowRight, History, Mail, SlidersHorizontal, Users } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { HomePortfolioReportsLink } from "@/components/home/home-portfolio-reports-link";
import { HomePropertySearchField } from "@/components/home/home-property-search-field";
import { HomeWorkspaceContinueSection } from "@/components/home/home-workspace-continue-section";
import { HomeWorkspaceLauncher } from "@/components/home/home-workspace-launcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, propertyInvitesApi } from "@/lib/api-client";
import { getAcceptInvitePathByInviteId } from "@/lib/invite-return-url";
import { queryKeys } from "@/lib/query-keys";
import { UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const StatMetricCard = memo(({ label, value }: Readonly<{ label: string; value: number }>) => (
  <Card className="border-border/80 border-l-2 border-l-primary/35 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
    <CardContent className="flex min-h-[4.5rem] items-center justify-between gap-4 py-4 pl-5 pr-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display shrink-0 text-right text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value.toLocaleString()}
      </p>
    </CardContent>
  </Card>
));
StatMetricCard.displayName = "StatMetricCard";

const StatsSectionSkeleton = memo(() => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
    {Array.from({ length: 1 }, (_, i) => (
      <Card
        className="border-border/80 border-l-2 border-l-muted bg-card/80 shadow-sm backdrop-blur-sm"
        key={i}
      >
        <CardContent className="flex min-h-[4.5rem] items-center justify-between gap-4 py-4 pl-5 pr-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-14 shrink-0" />
        </CardContent>
      </Card>
    ))}
  </div>
));
StatsSectionSkeleton.displayName = "StatsSectionSkeleton";

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
    <Card className="border-border/80 border-l-2 border-l-primary/35 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-primary">
          <Mail className="size-4" />
          <CardTitle className="text-base font-semibold">Pending invitations</CardTitle>
        </div>
        <CardDescription>You have {inviteCountLabel} waiting for your response.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="gap-2" variant="secondary">
          <Link to={getAcceptInvitePathByInviteId(firstInvite.inviteId)}>
            Review invitation
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
});
HomePendingPropertyInvitesBanner.displayName = "HomePendingPropertyInvitesBanner";

const HomePageInner = memo(() => {
  const userType = useAuthStore((state) => state.user?.userType);
  const isAdmin = userType === UserType.ADMIN;

  const statsQuery = useQuery({
    enabled: isAdmin,
    queryFn: () => adminApi.getAdminStats(),
    queryKey: queryKeys.platformStats(),
  });

  return (
    <AdminPageLayout>
      <div className="flex flex-col gap-8">
        <HomePendingPropertyInvitesBanner />

        {isAdmin ? (
          <section aria-label="Platform statistics">
            {statsQuery.isLoading ? <StatsSectionSkeleton /> : null}
            {statsQuery.isError ? (
              <p className="text-destructive text-sm">
                {statsQuery.error instanceof Error
                  ? statsQuery.error.message
                  : "Could not load platform statistics"}
              </p>
            ) : null}
            {statsQuery.data ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                <StatMetricCard label="Users" value={statsQuery.data.usersTotal} />
              </div>
            ) : null}
          </section>
        ) : null}

        <HomeWorkspaceContinueSection />
        <HomeWorkspaceLauncher />
        <HomePropertySearchField />
        <HomePortfolioReportsLink />

        {isAdmin ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary">
                  <Users className="size-4" />
                  <CardTitle className="text-base font-semibold">Users</CardTitle>
                </div>
                <CardDescription>Search, filter, and open individual accounts.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="gap-2" variant="secondary">
                  <Link to="/users">
                    Open directory
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary">
                  <History className="size-4" />
                  <CardTitle className="text-base font-semibold">Activity</CardTitle>
                </div>
                <CardDescription>Review admin audit events across the workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="gap-2" variant="secondary">
                  <Link to="/activity">
                    Open activity log
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary">
                  <SlidersHorizontal className="size-4" />
                  <CardTitle className="text-base font-semibold">Configuration</CardTitle>
                </div>
                <CardDescription>App versions, maintenance mode, and store URLs.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="gap-2" variant="secondary">
                  <Link to="/config">
                    Open settings
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AdminPageLayout>
  );
});
HomePageInner.displayName = "HomePageInner";

export const HomePage = HomePageInner;
