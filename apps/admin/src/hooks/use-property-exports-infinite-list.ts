import { type InfiniteData, keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { propertyExportsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  type IPropertyExportsListResponse,
  PROPERTY_EXPORTS_LIST_LIMIT,
  type TPropertyExportsListFilters,
} from "@/packages/shared";

export function usePropertyExportsInfiniteList(
  propertyId: string,
  filters: TPropertyExportsListFilters = {}
) {
  const listFilters = useMemo(
    () => ({ ...filters, limit: PROPERTY_EXPORTS_LIST_LIMIT }),
    [filters]
  );

  const query = useInfiniteQuery<
    IPropertyExportsListResponse,
    Error,
    InfiniteData<IPropertyExportsListResponse>,
    ReturnType<typeof queryKeys.propertyExports>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      propertyExportsApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: queryKeys.propertyExports(propertyId, filters),
  });

  const exports = useMemo(
    () => query.data?.pages.flatMap((page) => page.exports) ?? [],
    [query.data?.pages]
  );

  const meta = query.data?.pages[0]?.meta;

  return {
    error: query.error,
    exports,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
    meta,
  };
}
