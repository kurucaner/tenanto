import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { unitsApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { type ISortState } from "@/lib/table-sort";
import {
  type IPropertyUnitsListQuery,
  type IPropertyUnitsListResponse,
  UNITS_LIST_LIMIT,
} from "@/packages/shared";

export function usePropertyUnitsInfiniteList(propertyId: string, sortState: ISortState) {
  const listFilters = useMemo((): IPropertyUnitsListQuery => {
    const filters: IPropertyUnitsListQuery = {
      limit: UNITS_LIST_LIMIT,
    };

    if (sortState.columnId === "type") {
      filters.sortBy = "type";
      filters.sortDir = sortState.direction;
    }

    return filters;
  }, [sortState.columnId, sortState.direction]);

  const query = useInfiniteQuery<
    IPropertyUnitsListResponse,
    Error,
    InfiniteData<IPropertyUnitsListResponse>,
    ReturnType<typeof adminQueryKeys.propertyUnits>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => unitsApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: adminQueryKeys.propertyUnits(propertyId, listFilters),
  });

  const units = useMemo(
    () => query.data?.pages.flatMap((page) => page.units) ?? [],
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
    units,
  };
}
