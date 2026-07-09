import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { propertiesApi } from "@/lib/api-client";
import {
  PROPERTIES_LIST_LIMIT,
  PROPERTIES_LIST_STALE_TIME_MS,
} from "@/lib/properties-list-constants";
import { adminQueryKeys } from "@/lib/query-keys";
import { type IAdminPropertiesListResponse } from "@/packages/shared";

export function usePropertiesInfiniteList({
  enabled = true,
  q,
  staleTime = PROPERTIES_LIST_STALE_TIME_MS,
}: {
  enabled?: boolean;
  q?: string;
  staleTime?: number;
} = {}) {
  const listFilters = useMemo(
    () => ({
      limit: PROPERTIES_LIST_LIMIT,
      q: q || undefined,
    }),
    [q]
  );

  const query = useInfiniteQuery<
    IAdminPropertiesListResponse,
    Error,
    InfiniteData<IAdminPropertiesListResponse>,
    ReturnType<typeof adminQueryKeys.propertiesList>,
    string | undefined
  >({
    enabled,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => propertiesApi.list({ ...listFilters, cursor: pageParam }),
    queryKey: adminQueryKeys.propertiesList(listFilters),
    staleTime,
  });

  const properties = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
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
    properties,
  };
}
