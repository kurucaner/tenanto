import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useRef } from "react";

import { TableBody } from "@/components/ui/table";
import { useScrollMargin } from "@/hooks/use-scroll-margin";

export interface VirtualizedTableBodyProps<TItem> {
  /** Number of table columns, used by the spacer rows. */
  colSpan: number;
  estimateRowHeight: number;
  getItemKey: (item: TItem, index: number) => string;
  items: TItem[];
  overscan?: number;
  renderRow: (item: TItem, index: number) => ReactNode;
  /**
   * The scrollable ancestor element (e.g. a dialog body with overflow-y-auto).
   * Must be held in state via a callback ref by the caller, so that its
   * attachment triggers a re-render and the virtualizer can pick it up.
   */
  scrollElement: HTMLElement | null;
}

/**
 * Row virtualizer for shadcn Table bodies. Uses the spacer-row technique
 * (top/bottom padding rows) instead of absolute positioning, which preserves
 * table semantics: colgroup column widths and horizontally sticky cells keep
 * working. Rows are dynamically measured to support variable heights.
 */
export const VirtualizedTableBody = <TItem,>({
  colSpan,
  estimateRowHeight,
  getItemKey,
  items,
  overscan = 8,
  renderRow,
  scrollElement,
}: VirtualizedTableBodyProps<TItem>) => {
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);
  const scrollMargin = useScrollMargin(bodyRef, scrollElement);

  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => estimateRowHeight,
    getItemKey: (index) => {
      const item = items[index];
      return item === undefined ? index : getItemKey(item, index);
    },
    getScrollElement: () => scrollElement,
    overscan,
    scrollMargin,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];
  const paddingTop = firstItem ? firstItem.start - scrollMargin : 0;
  const paddingBottom = lastItem ? totalSize - (lastItem.end - scrollMargin) : 0;

  return (
    <TableBody ref={bodyRef}>
      {paddingTop > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: paddingTop, padding: 0 }} />
        </tr>
      ) : null}
      {virtualItems.map((virtualItem) => {
        const item = items[virtualItem.index];
        if (item === undefined) {
          return null;
        }
        return renderRow(item, virtualItem.index);
      })}
      {paddingBottom > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0 }} />
        </tr>
      ) : null}
    </TableBody>
  );
};
