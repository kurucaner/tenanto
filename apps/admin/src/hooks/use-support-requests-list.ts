import { type InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { type TAppliedSupportFilters } from "@/components/support/support-constants";
import {
  type TSupportListPageResponse,
  type TSupportListVariantConfig,
} from "@/components/support/support-list-config";
import { getIsListRefetching, refreshInfiniteList } from "@/lib/list-query-refetch";
import { type SupportCategory, type SupportRequestStatus } from "@/packages/shared";

export function useSupportRequestsList(config: TSupportListVariantConfig) {
  const queryClient = useQueryClient();
  const [statusInput, setStatusInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [applied, setApplied] = useState<TAppliedSupportFilters>({});

  const listQuery = useInfiniteQuery<
    TSupportListPageResponse,
    Error,
    InfiniteData<TSupportListPageResponse>,
    readonly unknown[],
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
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

  const applyFilters = useCallback(() => {
    setApplied({
      category: categoryInput === "" ? undefined : (categoryInput as SupportCategory),
      status: statusInput === "" ? undefined : (statusInput as SupportRequestStatus),
    });
  }, [categoryInput, statusInput]);

  const refresh = useCallback(async () => {
    await refreshInfiniteList(queryClient, config.getQueryKey(applied));
  }, [applied, config, queryClient]);

  return {
    applyFilters,
    categoryInput,
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
    setCategoryInput,
    setStatusInput,
    statusInput,
  };
}
