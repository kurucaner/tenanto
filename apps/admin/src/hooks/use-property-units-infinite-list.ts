import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { unitsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  type IPropertyUnitsListQuery,
  type IPropertyUnitsListResponse,
  type TPropertyUnitsListFilters,
  UNITS_LIST_LIMIT,
} from "@/packages/shared";

export function usePropertyUnitsInfiniteList(
  propertyId: string,
  filters: TPropertyUnitsListFilters
) {
  const listFilters = useMemo((): IPropertyUnitsListQuery => {
    const next: IPropertyUnitsListQuery = {
      limit: UNITS_LIST_LIMIT,
    };

    if (filters.from) next.from = filters.from;
    if (filters.to) next.to = filters.to;
    if (filters.q) next.q = filters.q;
    if (filters.rentalType) next.rentalType = filters.rentalType;
    if (filters.occupancy) next.occupancy = filters.occupancy;
    if (filters.sortBy) next.sortBy = filters.sortBy;
    if (filters.sortDir) next.sortDir = filters.sortDir;

    return next;
  }, [
    filters.from,
    filters.occupancy,
    filters.q,
    filters.rentalType,
    filters.sortBy,
    filters.sortDir,
    filters.to,
  ]);

  const query = useInfiniteQuery<
    IPropertyUnitsListResponse,
    Error,
    InfiniteData<IPropertyUnitsListResponse>,
    ReturnType<typeof queryKeys.propertyUnits>,
    string | undefined
  >({
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => unitsApi.list(propertyId, { ...listFilters, cursor: pageParam }),
    queryKey: queryKeys.propertyUnits(propertyId, listFilters),
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
