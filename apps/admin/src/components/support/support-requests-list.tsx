import { memo, useCallback, useMemo } from "react";

import { type TSupportListVariantConfig } from "@/components/support/support-list-config";
import { SupportRequestsTable } from "@/components/support/support-requests-table";
import { SupportRequestsToolbar } from "@/components/support/support-requests-toolbar";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import { useSupportRequestsList } from "@/hooks/use-support-requests-list";
import { useUrlDateRangeFilter } from "@/hooks/use-url-date-range-filter";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { getDateRangeSummary } from "@/lib/date-range-presets";
import { getFilteredTableFetchState } from "@/lib/filtered-table-fetch-state";
import { getDefaultSupportListDateRange } from "@/lib/support-list-date-defaults";
import {
  buildSupportListToolbarFilterItems,
  buildSupportToolbarClearAllPatch,
  buildSupportToolbarClearOnePatch,
  buildSupportToolbarClearSecondaryPatch,
  countSupportSecondaryFilters,
  formatSupportListCountLabel,
  isSupportCategory,
  isSupportListSortBy,
  isSupportListSortDir,
  isSupportRequestStatus,
  type TSupportListToolbarFilterId,
} from "@/lib/support-list-toolbar-filters";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import {
  SUPPORT_REQUESTS_DEFAULT_SORT_BY,
  SUPPORT_REQUESTS_DEFAULT_SORT_DIR,
} from "@/packages/shared";

export const SupportRequestsList = memo(
  ({ config }: Readonly<{ config: TSupportListVariantConfig }>) => {
    const defaultDateRange = useMemo(() => getDefaultSupportListDateRange(), []);
    const supportListFilterSchema = useMemo(
      () =>
        defineUrlFilterSchema<{
          allTime: string;
          category: string;
          from: string;
          q: string;
          status: string;
          to: string;
        }>({
          allTime: { defaultValue: "" },
          category: { defaultValue: "" },
          from: { defaultValue: defaultDateRange.from },
          q: { defaultValue: "" },
          status: { defaultValue: "" },
          to: { defaultValue: defaultDateRange.to },
        }),
      [defaultDateRange.from, defaultDateRange.to]
    );

    const { filters, setFilter, setFilters } = useUrlFilterState(supportListFilterSchema);
    const { allTime: allTimeParam, category, from, q, status, to } = filters;
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
      dateFilterSchema: supportListFilterSchema,
      from,
      to,
    });
    const { onSearchInputChange, searchInput } = useLedgerUrlSearch(q, setFilter);
    const sort = useUrlTableSort({
      defaultColumnId: SUPPORT_REQUESTS_DEFAULT_SORT_BY,
      defaultDirection: SUPPORT_REQUESTS_DEFAULT_SORT_DIR,
    });
    const applied = useMemo(
      () => ({
        category: isSupportCategory(category) ? category : undefined,
        from: effectiveFrom || undefined,
        q: q.trim() === "" ? undefined : q.trim(),
        sortBy: isSupportListSortBy(sort.sortState.columnId)
          ? sort.sortState.columnId
          : SUPPORT_REQUESTS_DEFAULT_SORT_BY,
        sortDir: isSupportListSortDir(sort.sortState.direction)
          ? sort.sortState.direction
          : SUPPORT_REQUESTS_DEFAULT_SORT_DIR,
        status: isSupportRequestStatus(status) ? status : undefined,
        to: effectiveTo || undefined,
      }),
      [
        category,
        effectiveFrom,
        effectiveTo,
        q,
        sort.sortState.columnId,
        sort.sortState.direction,
        status,
      ]
    );
    const {
      error,
      fetchNextPage,
      hasNextPage,
      isError,
      isFetching,
      isFetchingNextPage,
      isPending,
      isRefetching,
      refresh,
      rows,
    } = useSupportRequestsList(config, applied);
    const infiniteScrollSentinelRef = useInfiniteScrollTrigger({
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    });
    const { isFilterRefetching, isTableInitialPending } = getFilteredTableFetchState({
      isFetching,
      isFetchingNextPage,
      isPending,
      itemCount: rows.length,
    });
    const dateSummary = getDateRangeSummary(activePreset, displayFrom, displayTo);
    const activeFilterItems = useMemo(
      () =>
        buildSupportListToolbarFilterItems({
          activePreset,
          category,
          dateSummary,
          isDefaultDateRange:
            !allTime && from === defaultDateRange.from && to === defaultDateRange.to,
          q,
          status,
        }),
      [
        activePreset,
        allTime,
        category,
        dateSummary,
        defaultDateRange.from,
        defaultDateRange.to,
        from,
        q,
        status,
        to,
      ]
    );
    const activeFilterCount = useMemo(
      () => countSupportSecondaryFilters({ category, status }),
      [category, status]
    );
    const countLabel =
      rows.length > 0 ? formatSupportListCountLabel(rows.length, Boolean(hasNextPage)) : undefined;

    const handleRemoveFilter = useCallback(
      (id: TSupportListToolbarFilterId) => {
        if (id === "q") onSearchInputChange("");
        setFilters(buildSupportToolbarClearOnePatch(id, defaultDateRange));
      },
      [defaultDateRange, onSearchInputChange, setFilters]
    );

    const handleClearSecondaryFilters = useCallback(() => {
      setFilters(buildSupportToolbarClearSecondaryPatch());
    }, [setFilters]);

    const handleClearAll = useCallback(() => {
      onSearchInputChange("");
      setFilters(buildSupportToolbarClearAllPatch(defaultDateRange));
    }, [defaultDateRange, onSearchInputChange, setFilters]);

    return (
      <>
        {isError ? (
          <p className="text-destructive text-sm">
            {error instanceof Error ? error.message : config.errorMessage}
          </p>
        ) : null}
        <SupportRequestsTable
          emptyMessage={config.emptyMessage}
          hasNextPage={Boolean(hasNextPage)}
          infiniteScrollSentinelRef={infiniteScrollSentinelRef}
          isFetchingNextPage={isFetchingNextPage}
          isPending={isTableInitialPending}
          isRefreshing={isFilterRefetching}
          rows={rows}
          sort={sort}
          toolbar={
            <SupportRequestsToolbar
              activeFilterCount={activeFilterCount}
              activeFilterItems={activeFilterItems}
              activePreset={activePreset}
              category={category}
              countLabel={countLabel}
              from={displayFrom}
              isRefetching={isRefetching}
              onClearAll={handleClearAll}
              onClearSecondaryFilters={handleClearSecondaryFilters}
              onFilterChange={(key, value) => setFilter(key, value)}
              onFromChange={onFromChange}
              onPresetChange={onPresetChange}
              onRefetch={refresh}
              onRemoveFilter={handleRemoveFilter}
              onSearchInputChange={onSearchInputChange}
              onToChange={onToChange}
              searchInput={searchInput}
              searchPlaceholder={config.searchPlaceholder}
              status={status}
              to={displayTo}
            />
          }
          variant={config.tableVariant}
        />
      </>
    );
  }
);
SupportRequestsList.displayName = "SupportRequestsList";
