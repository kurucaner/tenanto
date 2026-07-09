import { type QueryClient } from "@tanstack/react-query";

export function getIsListRefetching(query: {
  isFetching: boolean;
  isFetchingNextPage?: boolean;
  isPending: boolean;
}): boolean {
  return query.isFetching && !query.isPending && !query.isFetchingNextPage;
}

export async function refreshInfiniteList(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): Promise<void> {
  await queryClient.resetQueries({ queryKey });
}
