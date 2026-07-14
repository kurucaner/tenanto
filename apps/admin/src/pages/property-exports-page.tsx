import { useQuery } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PropertyExportToolbar } from "@/components/exports/property-export-toolbar";
import { PropertyExportsTable } from "@/components/exports/property-exports-table";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import { usePropertyExportsInfiniteList } from "@/hooks/use-property-exports-infinite-list";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { useUrlDateRangeFilter } from "@/hooks/use-url-date-range-filter";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { settingsApi, unitsApi } from "@/lib/api-client";
import { getDateRangeSummary } from "@/lib/date-range-presets";
import {
  buildExportToolbarClearAllPatch,
  buildExportToolbarClearOnePatch,
  buildExportToolbarFilterItems,
  countExportSecondaryFilters,
  type TExportToolbarFilterId,
} from "@/lib/export-toolbar-filters";
import { buildExportFilterSummaryOptions } from "@/lib/property-export-utils";
import { queryKeys } from "@/lib/query-keys";
import { getDefaultReportDateRange } from "@/lib/report-date-defaults";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  type TExportResourceType,
  type TPropertyExportsListFilters,
  type TPropertyExportsListSortBy,
  type TPropertyExportsListSortDir,
} from "@/packages/shared";

function buildExportListFilters(input: {
  effectiveFrom: string;
  effectiveTo: string;
  q: string;
  resourceType: string;
  sortBy: TPropertyExportsListSortBy;
  sortDir: TPropertyExportsListSortDir;
}): TPropertyExportsListFilters {
  const filters: TPropertyExportsListFilters = {};
  if (input.effectiveFrom) filters.from = input.effectiveFrom;
  if (input.effectiveTo) filters.to = input.effectiveTo;
  const qTrim = input.q.trim();
  if (qTrim) filters.q = qTrim;
  if (input.resourceType) {
    filters.resourceType = input.resourceType as TExportResourceType;
  }
  if (input.sortBy) filters.sortBy = input.sortBy;
  if (input.sortDir) filters.sortDir = input.sortDir;
  return filters;
}

export const PropertyExportsPage = memo(() => {
  const { propertyId } = usePropertyShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightJobIdParam = searchParams.get("highlightJobId");
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const defaultDateRange = useMemo(() => getDefaultReportDateRange(), []);

  const exportFilterSchema = useMemo(
    () =>
      defineUrlFilterSchema<{
        allTime: string;
        from: string;
        q: string;
        resourceType: string;
        to: string;
      }>({
        allTime: { defaultValue: "true" },
        from: { defaultValue: defaultDateRange.from },
        q: { defaultValue: "" },
        resourceType: { defaultValue: "" },
        to: { defaultValue: defaultDateRange.to },
      }),
    [defaultDateRange.from, defaultDateRange.to]
  );

  const { filters, setFilter, setFilters } = useUrlFilterState(exportFilterSchema);
  const { allTime: allTimeParam, from, q, resourceType, to } = filters;
  const allTime = allTimeParam === "true";

  const {
    activePreset,
    displayFrom,
    displayTo,
    effectiveFrom,
    effectiveTo,
    onFromChange,
    onPresetChange,
    onToChange,
  } = useUrlDateRangeFilter({
    allTime,
    allTimeDefault: true,
    dateFilterSchema: exportFilterSchema,
    from,
    to,
  });

  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );

  const sortController = useUrlTableSort({
    defaultColumnId: "requestedAt",
    defaultDirection: "desc",
  });
  const { sortState } = sortController;

  const listFilters = useMemo(
    () =>
      buildExportListFilters({
        effectiveFrom,
        effectiveTo,
        q,
        resourceType,
        sortBy: sortState.columnId as TPropertyExportsListSortBy,
        sortDir: sortState.direction,
      }),
    [effectiveFrom, effectiveTo, q, resourceType, sortState.columnId, sortState.direction]
  );

  const { error, exports, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, meta } =
    usePropertyExportsInfiniteList(propertyId, listFilters);

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
    if (highlightJobIdParam != null && highlightJobIdParam !== "") {
      setHighlightedJobId(highlightJobIdParam);
    }
  }, [highlightJobIdParam]);

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

  const dateSummary = useMemo(
    () => getDateRangeSummary(activePreset, displayFrom, displayTo),
    [activePreset, displayFrom, displayTo]
  );

  const activeSecondaryFilterCount = countExportSecondaryFilters({ resourceType });

  const activeFilterItems = useMemo(
    () =>
      buildExportToolbarFilterItems({
        activePreset,
        allTime,
        dateSummary,
        resourceType,
      }),
    [activePreset, allTime, dateSummary, resourceType]
  );

  const handleExportFilterChange = useCallback(
    (key: "resourceType", value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  const handleClearSecondaryFilters = useCallback(() => {
    setFilters({ resourceType: "" });
  }, [setFilters]);

  const handleRemoveFilter = useCallback(
    (id: TExportToolbarFilterId) => {
      setFilters(buildExportToolbarClearOnePatch(id, defaultDateRange));
    },
    [defaultDateRange, setFilters]
  );

  const handleClearAll = useCallback(() => {
    setFilters(buildExportToolbarClearAllPatch(defaultDateRange));
    handleSearchInputChange("");
  }, [defaultDateRange, handleSearchInputChange, setFilters]);

  const countLabel = meta ? `${meta.totalCount} exports` : undefined;

  const toolbar = useMemo(
    () => (
      <PropertyExportToolbar
        activeFilterCount={activeSecondaryFilterCount}
        activeFilterItems={activeFilterItems}
        activePreset={activePreset}
        countLabel={countLabel}
        from={displayFrom}
        onClearAll={handleClearAll}
        onClearSecondaryFilters={handleClearSecondaryFilters}
        onFilterChange={handleExportFilterChange}
        onFromChange={onFromChange}
        onPresetChange={onPresetChange}
        onRemoveFilter={handleRemoveFilter}
        onSearchInputChange={handleSearchInputChange}
        onToChange={onToChange}
        resourceType={resourceType}
        searchInput={searchInput}
        to={displayTo}
      />
    ),
    [
      activeFilterItems,
      activePreset,
      activeSecondaryFilterCount,
      countLabel,
      displayFrom,
      displayTo,
      handleClearAll,
      handleClearSecondaryFilters,
      handleExportFilterChange,
      handleRemoveFilter,
      handleSearchInputChange,
      onFromChange,
      onPresetChange,
      onToChange,
      resourceType,
      searchInput,
    ]
  );

  if (error) {
    return (
      <p className="text-destructive text-sm">
        {error instanceof Error ? error.message : "Failed to load exports"}
      </p>
    );
  }

  return (
    <PropertyExportsTable
      exports={exports}
      filterSummaryOptions={filterSummaryOptions}
      hasNextPage={Boolean(hasNextPage)}
      highlightJobId={highlightedJobId}
      isFetchingNextPage={isFetchingNextPage}
      isPending={isPending}
      propertyId={propertyId}
      scrollSentinelRef={scrollSentinelRef}
      sort={sortController}
      toolbar={toolbar}
    />
  );
});
PropertyExportsPage.displayName = "PropertyExportsPage";
