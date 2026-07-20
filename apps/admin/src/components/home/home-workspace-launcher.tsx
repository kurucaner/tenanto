import { memo } from "react";

import { HomePropertyWorkspaceCard } from "@/components/home/home-property-workspace-card";
import { HomeWorkspaceEmptyState } from "@/components/home/home-workspace-empty-state";
import { Button } from "@/components/ui/button";
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

const HomeWorkspaceLauncherErrorState = memo(
  ({
    errorMessage,
    onRetry,
  }: {
    errorMessage: string;
    onRetry: () => void;
  }) => (
    <Card className="border-destructive/30 bg-card/80 shadow-sm">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-destructive text-sm">{errorMessage}</p>
        <Button className="shrink-0" onClick={onRetry} type="button" variant="outline">
          Try again
        </Button>
      </CardContent>
    </Card>
  )
);
HomeWorkspaceLauncherErrorState.displayName = "HomeWorkspaceLauncherErrorState";

export const HomeWorkspaceLauncher = memo(() => {
  const currentUser = useAuthStore((state) => state.user);
  const { error, isError, isPending, properties, refetch } = useHomeWorkspaceProperties();

  const errorMessage =
    error instanceof Error ? error.message : "Could not load your properties. Please try again.";

  return (
    <section aria-label="Your properties" className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Your properties</h2>
        <p className="text-muted-foreground text-sm">
          Jump to units, leases, income, and expenses in one click.
        </p>
      </div>

      {isPending ? <HomeWorkspaceLauncherSkeleton /> : null}

      {isError && properties.length === 0 ? (
        <HomeWorkspaceLauncherErrorState
          errorMessage={errorMessage}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isPending && !isError && properties.length === 0 ? <HomeWorkspaceEmptyState /> : null}

      {!isPending && properties.length > 0 ? (
        <div className="space-y-4">
          {isError ? (
            <HomeWorkspaceLauncherErrorState
              errorMessage={errorMessage}
              onRetry={() => {
                void refetch();
              }}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <HomePropertyWorkspaceCard
                currentUser={currentUser}
                key={property.id}
                property={property}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
});
HomeWorkspaceLauncher.displayName = "HomeWorkspaceLauncher";
