import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { incomeLinesApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  INCOME_ENTRIES_LIST_LIMIT,
  type IPropertyIncomeLinesListQuery,
  type IPropertyIncomeLinesListResponse,
} from "@/packages/shared";

export type TPropertyIncomeLinesInfiniteListFilters = Omit<
  IPropertyIncomeLinesListQuery,
  "cursor" | "limit"
>;

export function usePropertyIncomeLinesInfiniteList(
  propertyId: string,
  filters: TPropertyIncomeLinesInfiniteListFilters,
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
    IPropertyIncomeLinesListResponse,
    Error,
    InfiniteData<IPropertyIncomeLinesListResponse>,
    ReturnType<typeof queryKeys.propertyIncomeLines>,
    string | undefined
  >({
    enabled: options.enabled ?? true,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      incomeLinesApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: queryKeys.propertyIncomeLines(propertyId, filters),
  });

  const incomeLines = useMemo(
    () => query.data?.pages.flatMap((page) => page.incomeLines) ?? [],
    [query.data?.pages]
  );

  const meta = query.data?.pages[0]?.meta;

  return {
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    incomeLines,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
    meta,
  };
}
