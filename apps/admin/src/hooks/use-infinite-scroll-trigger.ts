import { useEffect, useRef } from "react";

export function useInfiniteScrollTrigger({
  enabled = true,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  rootMargin = "200px",
}: {
  enabled?: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !hasNextPage) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin, threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, fetchNextPage, hasNextPage, isFetchingNextPage, rootMargin]);

  return sentinelRef;
}
