import { useEffect } from "react";

export function useFetchAllInfinitePages({
  enabled = true,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: {
  enabled?: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
}) {
  useEffect(() => {
    if (!enabled || !hasNextPage || isFetchingNextPage) {
      return;
    }

    fetchNextPage();
  }, [enabled, fetchNextPage, hasNextPage, isFetchingNextPage]);
}
