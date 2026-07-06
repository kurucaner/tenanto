import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { LifeBuoy } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { SupportFiltersBar } from "@/components/support/support-filters-bar";
import { SupportRequestsTable } from "@/components/support/support-requests-table";
import { type TAppliedSupportFilters } from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  type IAdminSupportRequestsListResponse,
  type SupportCategory,
  type SupportRequestStatus,
} from "@/packages/shared";

const SupportRequestsPageInner = memo(() => {
  const [statusInput, setStatusInput] = useState<string>("");
  const [categoryInput, setCategoryInput] = useState<string>("");
  const [applied, setApplied] = useState<TAppliedSupportFilters>({});

  const listQuery = useInfiniteQuery<
    IAdminSupportRequestsListResponse,
    Error,
    InfiniteData<IAdminSupportRequestsListResponse>,
    ReturnType<typeof adminQueryKeys.supportRequestsList>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      adminApi.listSupportRequests({
        category: applied.category,
        cursor: pageParam,
        limit: 20,
        status: applied.status,
      }),
    queryKey: adminQueryKeys.supportRequestsList({
      category: applied.category,
      status: applied.status,
    }),
  });

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data?.pages]
  );

  const applyFilters = () => {
    setApplied({
      category: categoryInput === "" ? undefined : (categoryInput as SupportCategory),
      status: statusInput === "" ? undefined : (statusInput as SupportRequestStatus),
    });
  };

  return (
    <AdminPageLayout intro={{ eyebrow: "Support", title: "Support requests" }}>
      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-primary">
            <LifeBuoy className="size-4" />
            <CardTitle className="text-base font-semibold">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <SupportFiltersBar
            categoryInput={categoryInput}
            idPrefix="admin-support"
            onApply={applyFilters}
            onCategoryChange={setCategoryInput}
            onStatusChange={setStatusInput}
            statusInput={statusInput}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Requests</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {listQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}
          {listQuery.isError ? (
            <p className="text-destructive text-sm">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : "Could not load requests."}
            </p>
          ) : null}
          {rows.length > 0 ? <SupportRequestsTable rows={rows} variant="admin" /> : null}
          {listQuery.hasNextPage ? (
            <Button
              className="self-start"
              disabled={listQuery.isFetchingNextPage}
              onClick={() => {
                listQuery.fetchNextPage().catch(() => {});
              }}
              type="button"
              variant="outline"
            >
              {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          ) : null}
          {!listQuery.isPending && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No support requests match these filters.</p>
          ) : null}
        </CardContent>
      </Card>
    </AdminPageLayout>
  );
});
SupportRequestsPageInner.displayName = "SupportRequestsPageInner";

export const SupportRequestsPage = SupportRequestsPageInner;
