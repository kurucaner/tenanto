export function getFilteredTableFetchState(input: {
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  itemCount: number;
}): {
  isFilterRefetching: boolean;
  isTableInitialPending: boolean;
} {
  const { isFetching, isFetchingNextPage, isPending, itemCount } = input;

  return {
    isFilterRefetching: isFetching && !isFetchingNextPage && itemCount > 0,
    isTableInitialPending: isPending && itemCount === 0,
  };
}
