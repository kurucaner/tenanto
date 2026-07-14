import { type InfiniteData, keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { shortStaysApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  INCOME_ENTRIES_LIST_LIMIT,
  type IPropertyReservationsListQuery,
  type IPropertyShortStaysListResponse,
} from "@/packages/shared";

export type TPropertyShortStaysInfiniteListFilters = Omit<
  IPropertyReservationsListQuery,
  "cursor" | "limit"
>;

export function usePropertyShortStaysInfiniteList(
  propertyId: string,
  filters: TPropertyShortStaysInfiniteListFilters,
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
    IPropertyShortStaysListResponse,
    Error,
    InfiniteData<IPropertyShortStaysListResponse>,
    ReturnType<typeof queryKeys.propertyShortStays>,
    string | undefined
  >({
    enabled: options.enabled ?? true,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      shortStaysApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: queryKeys.propertyShortStays(propertyId, filters),
  });

  const shortStays = useMemo(
    () => query.data?.pages.flatMap((page) => page.shortStays) ?? [],
    [query.data?.pages]
  );

  const meta = query.data?.pages[0]?.meta;

  return {
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
    meta,
    shortStays,
  };
}
