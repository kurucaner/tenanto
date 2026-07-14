import { type InfiniteData, keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { notificationsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  type IUserNotificationsListResponse,
  USER_NOTIFICATIONS_LIST_LIMIT,
} from "@/packages/shared";

export function useNotificationsInfiniteList() {
  const query = useInfiniteQuery<
    IUserNotificationsListResponse,
    Error,
    InfiniteData<IUserNotificationsListResponse>,
    ReturnType<typeof queryKeys.notificationsList>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      notificationsApi.list({ cursor: pageParam, limit: USER_NOTIFICATIONS_LIST_LIMIT }),
    queryKey: queryKeys.notificationsList(),
  });

  const items = useMemo(
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
    items,
  };
}
