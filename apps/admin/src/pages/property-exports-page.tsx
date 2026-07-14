import { useQuery } from "@tanstack/react-query";
import { memo, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PropertyExportsTable } from "@/components/exports/property-exports-table";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { usePropertyExportsInfiniteList } from "@/hooks/use-property-exports-infinite-list";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { settingsApi, unitsApi } from "@/lib/api-client";
import { buildExportFilterSummaryOptions } from "@/lib/property-export-utils";
import { queryKeys } from "@/lib/query-keys";

export const PropertyExportsPage = memo(() => {
  const { propertyId } = usePropertyShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightJobIdParam = searchParams.get("highlightJobId");
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (highlightJobIdParam != null && highlightJobIdParam !== "") {
      setHighlightedJobId(highlightJobIdParam);
    }
  }, [highlightJobIdParam]);

  const { error, exports, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, meta } =
    usePropertyExportsInfiniteList(propertyId);

  const scrollSentinelRef = useInfiniteScrollTrigger({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  const settingsQuery = useQuery({
    queryFn: () => settingsApi.get(propertyId),
    queryKey: queryKeys.propertySettings(propertyId),
  });

  const unitsQuery = useQuery({
    queryFn: () => unitsApi.list(propertyId),
    queryKey: queryKeys.propertyUnits(propertyId),
  });

  const filterSummaryOptions = useMemo(
    () =>
      buildExportFilterSummaryOptions(
        settingsQuery.data?.settings,
        unitsQuery.data?.units ?? []
      ),
    [settingsQuery.data?.settings, unitsQuery.data?.units]
  );

  useEffect(() => {
    if (highlightedJobId == null || isPending) {
      return;
    }

    const row = document.getElementById(`export-job-${highlightedJobId}`);
    if (row == null) {
      return;
    }

    row.scrollIntoView({ behavior: "smooth", block: "center" });

    const timeoutId = globalThis.setTimeout(() => {
      setHighlightedJobId(null);
      if (highlightJobIdParam != null) {
        setSearchParams(
          (current) => {
            const nextParams = new URLSearchParams(current);
            nextParams.delete("highlightJobId");
            return nextParams;
          },
          { replace: true }
        );
      }
    }, 4_000);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [exports, highlightJobIdParam, highlightedJobId, isPending, setSearchParams]);

  const countLabel = meta ? `${meta.totalCount} exports` : undefined;

  if (error) {
    return (
      <p className="text-destructive text-sm">
        {error instanceof Error ? error.message : "Failed to load exports"}
      </p>
    );
  }

  return (
    <PropertyExportsTable
      countLabel={countLabel}
      exports={exports}
      filterSummaryOptions={filterSummaryOptions}
      hasNextPage={Boolean(hasNextPage)}
      highlightJobId={highlightedJobId}
      isFetchingNextPage={isFetchingNextPage}
      isPending={isPending}
      propertyId={propertyId}
      scrollSentinelRef={scrollSentinelRef}
    />
  );
});
PropertyExportsPage.displayName = "PropertyExportsPage";
