import { createContext, useContext } from "react";

/**
 * Exposes the admin layout's scrollable content element so pages can
 * virtualize long lists against it (TanStack Virtual needs the actual scroll
 * container). Held in state via a callback ref in the layout, so consumers
 * re-render when it attaches.
 */
export const LayoutScrollContext = createContext<HTMLElement | null>(null);

export function useLayoutScrollElement(): HTMLElement | null {
  return useContext(LayoutScrollContext);
}
