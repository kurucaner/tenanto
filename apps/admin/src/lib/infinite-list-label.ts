export function getInfiniteListLoadMoreLabel({
  hasNextPage,
  isFetchingNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}): string {
  if (isFetchingNextPage) {
    return "Loading…";
  }
  if (hasNextPage) {
    return "Load more";
  }
  return "End of list";
}
