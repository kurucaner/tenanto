import { LifeBuoy } from "lucide-react";
import { memo } from "react";

import { RefetchButton } from "@/components/data/refetch-button";
import { SupportFiltersBar } from "@/components/support/support-filters-bar";
import { type TSupportListVariantConfig } from "@/components/support/support-list-config";
import { SupportRequestsTable } from "@/components/support/support-requests-table";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupportRequestsList } from "@/hooks/use-support-requests-list";

function getLoadMoreLabel(isFetchingNextPage: boolean): string {
  return isFetchingNextPage ? "Loading…" : "Load more";
}

export const SupportRequestsList = memo(
  ({ config }: Readonly<{ config: TSupportListVariantConfig }>) => {
    const {
      applyFilters,
      categoryInput,
      error,
      fetchNextPage,
      hasNextPage,
      isError,
      isFetchingNextPage,
      isPending,
      isRefetching,
      refresh,
      rows,
      setCategoryInput,
      setStatusInput,
      statusInput,
    } = useSupportRequestsList(config);

    return (
      <>
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
              idPrefix={config.filterIdPrefix}
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
            <CardAction>
              <RefetchButton isRefetching={isRefetching} onRefetch={refresh} />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : null}
            {isError ? (
              <p className="text-destructive text-sm">
                {error instanceof Error ? error.message : config.errorMessage}
              </p>
            ) : null}
            {rows.length > 0 ? (
              <SupportRequestsTable rows={rows} variant={config.tableVariant} />
            ) : null}
            {hasNextPage ? (
              <Button
                className="self-start"
                disabled={isFetchingNextPage}
                onClick={() => {
                  fetchNextPage().catch(() => {});
                }}
                type="button"
                variant="outline"
              >
                {getLoadMoreLabel(isFetchingNextPage)}
              </Button>
            ) : null}
            {!isPending && rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{config.emptyMessage}</p>
            ) : null}
          </CardContent>
        </Card>
      </>
    );
  }
);
SupportRequestsList.displayName = "SupportRequestsList";
