import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { longStaysApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  type IPropertyLongStaysListQuery,
  type IPropertyLongStaysListResponse,
  LEASES_LIST_LIMIT,
} from "@/packages/shared";

export type TPropertyLongStaysListFilters = Pick<IPropertyLongStaysListQuery, "status" | "unitId">;

export function usePropertyLongStaysInfiniteList(
  propertyId: string,
  filters: TPropertyLongStaysListFilters
) {
  const listFilters = useMemo(
    () => ({
      ...filters,
      limit: LEASES_LIST_LIMIT,
    }),
    [filters]
  );

  const query = useInfiniteQuery<
    IPropertyLongStaysListResponse,
    Error,
    InfiniteData<IPropertyLongStaysListResponse>,
    ReturnType<typeof adminQueryKeys.propertyLongStays>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      longStaysApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: adminQueryKeys.propertyLongStays(propertyId, filters),
  });

  const longStays = useMemo(
    () => query.data?.pages.flatMap((page) => page.longStays) ?? [],
    [query.data?.pages]
  );

  return {
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
    longStays,
  };
}
