import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";

import { AdminAuditEventDetails } from "@/components/admin-audit-shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IAdminAuditEventsListResponse } from "@/packages/shared";

const AdminUserAuditSectionInner = memo(({ userId }: { userId: string }) => {
  const query = useInfiniteQuery<
    IAdminAuditEventsListResponse,
    Error,
    InfiniteData<IAdminAuditEventsListResponse>,
    ReturnType<typeof adminQueryKeys.userAudit>,
    string | undefined
  >({
    enabled: Boolean(userId),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      adminApi.listUserAuditEvents(userId, { cursor: pageParam, limit: 15 }),
    queryKey: adminQueryKeys.userAudit(userId),
  });

  const events = useMemo(
    () => query.data?.pages.flatMap((p) => p.events) ?? [],
    [query.data?.pages]
  );

  if (query.isPending) {
    return (
      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
          <CardDescription>Admin changes for this user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">
            {query.error instanceof Error ? query.error.message : "Failed to load activity"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
        <CardDescription>Who changed what, and when (admin actions only).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No admin events yet for this user.</p>
        ) : (
          events.map((event, i) => (
            <div key={event.id}>
              {i > 0 ? <Separator className="my-4" /> : null}
              <AdminAuditEventDetails event={event} />
            </div>
          ))
        )}
        {query.hasNextPage ? (
          <Button
            className="mt-4 self-center"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
            type="button"
            variant="outline"
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
});
AdminUserAuditSectionInner.displayName = "AdminUserAuditSectionInner";

export const AdminUserAuditSection = AdminUserAuditSectionInner;
