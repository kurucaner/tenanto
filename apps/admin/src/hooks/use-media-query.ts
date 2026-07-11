import { useSyncExternalStore } from "react";

/** Tailwind's lg breakpoint. */
export const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function subscribe(query: string, onStoreChange: () => void): () => void {
  const mediaQueryList = globalThis.matchMedia(query);
  mediaQueryList.addEventListener("change", onStoreChange);
  return () => mediaQueryList.removeEventListener("change", onStoreChange);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(query, onStoreChange),
    () => globalThis.matchMedia(query).matches
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_MEDIA_QUERY);
}
