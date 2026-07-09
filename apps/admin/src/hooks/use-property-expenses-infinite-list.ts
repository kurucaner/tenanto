import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { expensesApi } from "@/lib/api-client";
import { EXPENSES_LIST_LIMIT } from "@/lib/expenses-list-constants";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  type IPropertyExpensesListQuery,
  type IPropertyExpensesListResponse,
} from "@/packages/shared";

export type TPropertyExpensesListFilters = Pick<
  IPropertyExpensesListQuery,
  "category" | "from" | "to"
>;

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
    ReturnType<typeof adminQueryKeys.propertyExpenses>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => expensesApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: adminQueryKeys.propertyExpenses(propertyId, filters),
  });

  const expenses = useMemo(
    () => query.data?.pages.flatMap((page) => page.expenses) ?? [],
    [query.data?.pages]
  );

  return {
    error: query.error,
    expenses,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
  };
}
