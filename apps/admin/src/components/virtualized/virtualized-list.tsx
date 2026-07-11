import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useRef } from "react";

import { useScrollMargin } from "@/hooks/use-scroll-margin";

export interface VirtualizedListProps<TItem> {
  className?: string;
  estimateItemHeight: number;
  getItemKey: (item: TItem, index: number) => string;
  items: TItem[];
  overscan?: number;
  renderItem: (item: TItem, index: number) => ReactNode;
  /**
   * The scrollable ancestor element (e.g. a dialog body with overflow-y-auto).
   * Must be held in state via a callback ref by the caller, so that its
   * attachment triggers a re-render and the virtualizer can pick it up.
   */
  scrollElement: HTMLElement | null;
}

/**
 * Generic vertical list virtualizer for stacked elements (cards, li rows).
 * Items are absolutely positioned and dynamically measured, so variable
 * heights are supported. The scroll container is external; the list's offset
 * inside it is accounted for via scrollMargin.
 */
export const VirtualizedList = <TItem,>({
  className,
  estimateItemHeight,
  getItemKey,
  items,
  overscan = 8,
  renderItem,
  scrollElement,
}: VirtualizedListProps<TItem>) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollMargin = useScrollMargin(listRef, scrollElement);

  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => estimateItemHeight,
    getItemKey: (index) => {
      const item = items[index];
      return item === undefined ? index : getItemKey(item, index);
    },
    getScrollElement: () => scrollElement,
    overscan,
    scrollMargin,
  });

  return (
    <div
      className={className}
      ref={listRef}
      style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];
        if (item === undefined) {
          return null;
        }
        return (
          <div
            data-index={virtualItem.index}
            key={virtualItem.key}
            ref={virtualizer.measureElement}
            style={{
              left: 0,
              position: "absolute",
              top: 0,
              transform: `translateY(${virtualItem.start - scrollMargin}px)`,
              width: "100%",
            }}
          >
            {renderItem(item, virtualItem.index)}
          </div>
        );
      })}
    </div>
  );
};
