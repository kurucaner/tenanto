import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * Measures the offset of a virtualized region inside its scroll container so
 * the virtualizer's coordinates can account for content rendered above it
 * (TanStack Virtual's scrollMargin option).
 */
export function useScrollMargin(
  elementRef: RefObject<HTMLElement | null>,
  scrollElement: HTMLElement | null
): number {
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || !scrollElement) {
      return;
    }
    const elementTop = element.getBoundingClientRect().top;
    const containerTop = scrollElement.getBoundingClientRect().top;
    setScrollMargin(elementTop - containerTop + scrollElement.scrollTop);
  }, [elementRef, scrollElement]);

  return scrollMargin;
}
