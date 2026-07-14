import { type InfiniteData, keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { incomeEntriesApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  INCOME_ENTRIES_LIST_LIMIT,
  type IPropertyIncomeEntriesListResponse,
  type TPropertyIncomeEntriesListFilters,
} from "@/packages/shared";

export type { TPropertyIncomeEntriesListFilters };

export function usePropertyIncomeEntriesInfiniteList(
  propertyId: string,
  filters: TPropertyIncomeEntriesListFilters,
  options: { enabled?: boolean } = {}
) {
  const listFilters = useMemo(
    () => ({
      ...filters,
      limit: INCOME_ENTRIES_LIST_LIMIT,
    }),
    [filters]
  );

  const query = useInfiniteQuery<
    IPropertyIncomeEntriesListResponse,
    Error,
    InfiniteData<IPropertyIncomeEntriesListResponse>,
    ReturnType<typeof queryKeys.propertyIncomeEntries>,
    string | undefined
  >({
    enabled: options.enabled ?? true,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      incomeEntriesApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: queryKeys.propertyIncomeEntries(propertyId, filters),
  });

  const entries = useMemo(
    () => query.data?.pages.flatMap((page) => page.entries) ?? [],
    [query.data?.pages]
  );

  const meta = query.data?.pages[0]?.meta;

  return {
    entries,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
    meta,
  };
}
