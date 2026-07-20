import { memo } from "react";

import { HomePropertyWorkspaceCard } from "@/components/home/home-property-workspace-card";
import { HomeWorkspaceEmptyState } from "@/components/home/home-workspace-empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHomeWorkspaceProperties } from "@/hooks/use-home-workspace-properties";
import { useAuthStore } from "@/stores/auth-store";

const HOME_WORKSPACE_LAUNCHER_SKELETON_COUNT = 3;

const HomeWorkspaceLauncherSkeleton = memo(() => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: HOME_WORKSPACE_LAUNCHER_SKELETON_COUNT }, (_, index) => (
      <Card className="border-border/80 bg-card/80 shadow-sm" key={index}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            <Skeleton className="size-8 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    ))}
  </div>
));
HomeWorkspaceLauncherSkeleton.displayName = "HomeWorkspaceLauncherSkeleton";

export const HomeWorkspaceLauncher = memo(() => {
  const currentUser = useAuthStore((state) => state.user);
  const { isError, isPending, properties } = useHomeWorkspaceProperties();

  return (
    <section aria-label="Your properties" className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Your properties</h2>
        <p className="text-muted-foreground text-sm">
          Jump to units, leases, income, and expenses in one click.
        </p>
      </div>

      {isPending ? <HomeWorkspaceLauncherSkeleton /> : null}

      {isError ? (
        <p className="text-destructive text-sm">Could not load your properties. Please try again.</p>
      ) : null}

      {!isPending && !isError && properties.length === 0 ? <HomeWorkspaceEmptyState /> : null}

      {!isPending && properties.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <HomePropertyWorkspaceCard
              currentUser={currentUser}
              key={property.id}
              property={property}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
});
HomeWorkspaceLauncher.displayName = "HomeWorkspaceLauncher";
