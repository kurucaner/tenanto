import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { AdminAuditEventDetails } from "@/components/admin-audit-shared";
import { AdminPageIntro } from "@/components/admin-page-intro";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IAdminAuditEventsListQuery, IAdminAuditEventsListResponse } from "@/packages/shared";

type TAppliedAuditFilters = Omit<IAdminAuditEventsListQuery, "cursor" | "limit">;

const ActivityPageInner = memo(() => {
  const [resourceTypeInput, setResourceTypeInput] = useState("");
  const [resourceIdInput, setResourceIdInput] = useState("");
  const [actorUserIdInput, setActorUserIdInput] = useState("");
  const [applied, setApplied] = useState<TAppliedAuditFilters>({});

  const query = useInfiniteQuery<
    IAdminAuditEventsListResponse,
    Error,
    InfiniteData<IAdminAuditEventsListResponse>,
    ReturnType<typeof adminQueryKeys.auditLog>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      adminApi.listAuditEvents({
        actor_user_id: applied.actor_user_id,
        cursor: pageParam,
        limit: 20,
        resource_id: applied.resource_id,
        resource_type: applied.resource_type,
      }),
    queryKey: adminQueryKeys.auditLog(applied),
  });

  const events = useMemo(
    () => query.data?.pages.flatMap((p) => p.events) ?? [],
    [query.data?.pages]
  );

  const applyFilters = () => {
    const resource_type = resourceTypeInput.trim() || undefined;
    const resource_id = resourceIdInput.trim() || undefined;
    const actor_user_id = actorUserIdInput.trim() || undefined;
    setApplied({ actor_user_id, resource_id, resource_type });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <AdminPageIntro
        description="Immutable record of admin mutations: who acted, on which resource, and what changed."
        eyebrow="Audit"
        title="Activity log"
      />

      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-primary">
            <History className="size-4" />
            <CardTitle className="text-base font-semibold">Filters</CardTitle>
          </div>
          <CardDescription>
            Optional. Leave blank to show all events (newest first).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[140px] flex-1 flex-col gap-2">
            <Label htmlFor="audit-resource-type">Resource type</Label>
            <Input
              id="audit-resource-type"
              onChange={(e) => setResourceTypeInput(e.target.value)}
              placeholder="e.g. user"
              value={resourceTypeInput}
            />
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-2">
            <Label htmlFor="audit-resource-id">Resource ID (UUID)</Label>
            <Input
              id="audit-resource-id"
              onChange={(e) => setResourceIdInput(e.target.value)}
              placeholder="target entity id"
              value={resourceIdInput}
            />
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-2">
            <Label htmlFor="audit-actor-id">Actor user ID (UUID)</Label>
            <Input
              id="audit-actor-id"
              onChange={(e) => setActorUserIdInput(e.target.value)}
              placeholder="admin who performed action"
              value={actorUserIdInput}
            />
          </div>
          <Button onClick={applyFilters} type="button" variant="secondary">
            Apply filters
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Events</CardTitle>
          <CardDescription>Append-only admin audit trail.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          {query.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}
          {query.isError ? (
            <p className="text-destructive text-sm">
              {query.error instanceof Error ? query.error.message : "Failed to load activity"}
            </p>
          ) : null}
          {!query.isPending && !query.isError && events.length === 0 ? (
            <p className="text-muted-foreground text-sm">No events match these filters.</p>
          ) : null}
          {!query.isPending && !query.isError && events.length > 0
            ? events.map((event, i) => (
                <div key={event.id}>
                  {i > 0 ? <Separator className="my-4" /> : null}
                  <AdminAuditEventDetails event={event} showUserResourceLink />
                </div>
              ))
            : null}
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
    </div>
  );
});
ActivityPageInner.displayName = "ActivityPageInner";

export const ActivityPage = ActivityPageInner;
