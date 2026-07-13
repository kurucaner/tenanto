import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { expensesApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  EXPENSES_LIST_LIMIT,
  type IPropertyExpensesListResponse,
  type TPropertyExpensesListFilters,
} from "@/packages/shared";

export type { TPropertyExpensesListFilters };

export function usePropertyExpensesInfiniteList(
  propertyId: string,
  filters: TPropertyExpensesListFilters
) {
  const listFilters = useMemo(
    () => ({
      ...filters,
      limit: EXPENSES_LIST_LIMIT,
    }),
    [filters]
  );

  const query = useInfiniteQuery<
    IPropertyExpensesListResponse,
    Error,
    InfiniteData<IPropertyExpensesListResponse>,
    ReturnType<typeof queryKeys.propertyExpenses>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => expensesApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: queryKeys.propertyExpenses(propertyId, filters),
  });

  const expenses = useMemo(
    () => query.data?.pages.flatMap((page) => page.expenses) ?? [],
    [query.data?.pages]
  );

  const meta = query.data?.pages[0]?.meta;

  return {
    error: query.error,
    expenses,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
    meta,
  };
}
