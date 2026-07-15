import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { type TAppliedSupportFilters } from "@/components/support/support-constants";
import {
  type TSupportListPageResponse,
  type TSupportListVariantConfig,
} from "@/components/support/support-list-config";
import { getIsListRefetching, refreshInfiniteList } from "@/lib/list-query-refetch";

export function useSupportRequestsList(
  config: TSupportListVariantConfig,
  applied: TAppliedSupportFilters
) {
  const queryClient = useQueryClient();

  const listQuery = useInfiniteQuery<
    TSupportListPageResponse,
    Error,
    InfiniteData<TSupportListPageResponse>,
    readonly unknown[],
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      config.fetchPage({
        applied,
        cursor: pageParam,
      }),
    queryKey: config.getQueryKey(applied),
  });

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data?.pages]
  );

  const refresh = useCallback(async () => {
    await refreshInfiniteList(queryClient, config.getQueryKey(applied));
  }, [applied, config, queryClient]);

  return {
    error: listQuery.error,
    fetchNextPage: listQuery.fetchNextPage,
    hasNextPage: listQuery.hasNextPage,
    isError: listQuery.isError,
    isFetching: listQuery.isFetching,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    isPending: listQuery.isPending,
    isRefetching: getIsListRefetching(listQuery),
    refresh,
    rows,
  };
}
