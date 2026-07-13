import { type ReactNode, type RefObject } from "react";

import {
  type DataTableColumn,
  type DataTableSortController,
} from "@/components/data-table/data-table-types";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VirtualizedTableBody } from "@/components/virtualized/virtualized-table-body";
import { useLayoutScrollElement } from "@/contexts/layout-scroll-context";
import { getInfiniteListLoadMoreLabel } from "@/lib/infinite-list-label";

export interface DataTableInfiniteScroll {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

export interface DataTableVirtualization {
  estimateRowHeight: number;
  overscan?: number;
}

export interface DataTableProps<TItem> {
  columns: DataTableColumn[];
  emptyMessage: ReactNode;
  /** Rendered above the table with standard spacing. */
  filters?: ReactNode;
  /** TableFooter rows (e.g. aggregate totals). */
  footer?: ReactNode;
  getItemKey: (item: TItem) => string;
  /** Renders a fetching skeleton row, a scroll sentinel, and an end-of-list caption. */
  infiniteScroll?: DataTableInfiniteScroll;
  /**
   * Scroll sentinel observed by the page's infinite-scroll trigger. Kept
   * separate from `infiniteScroll` so the React Compiler doesn't treat that
   * object as a ref (refs must not be read during render).
   */
  infiniteScrollSentinelRef?: RefObject<HTMLDivElement | null>;
  /** Initial load: renders skeleton bars in place of the table. */
  isPending?: boolean;
  items: TItem[];
  renderRow: (item: TItem, index: number) => ReactNode;
  /** Enables SortableTableHead for columns marked sortable (pass useUrlTableSort's return). */
  sort?: DataTableSortController;
  /** Compact controls rendered directly above the table. */
  toolbar?: ReactNode;
  /** Virtualizes rows against the admin layout scroll container. */
  virtualization?: DataTableVirtualization;
}

const LOADING_SKELETON = (
  <div className="space-y-3">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
  </div>
);

interface DataTableHeadCellProps {
  column: DataTableColumn;
  sort?: DataTableSortController;
}
function DataTableHeadCell({ column, sort }: Readonly<DataTableHeadCellProps>) {
  const sortable = Boolean(column.sortable && sort);

  return (
    <SortableTableHead
      align={column.align}
      ariaSort={sort ? sort.getColumnAriaSort(column.id) : "none"}
      direction={sort ? sort.getColumnDirection(column.id) : null}
      info={column.info}
      label={column.label}
      onSort={() => sort?.toggleSort(column.id)}
      sortable={sortable}
    />
  );
}

export const DataTable = <TItem,>({
  columns,
  emptyMessage,
  filters,
  footer,
  getItemKey,
  infiniteScroll,
  infiniteScrollSentinelRef,
  isPending = false,
  items,
  renderRow,
  sort,
  toolbar,
  virtualization,
}: DataTableProps<TItem>) => {
  const scrollElement = useLayoutScrollElement();
  const visibleColumns = columns.filter((column) => !column.hidden);
  const colSpan = visibleColumns.length;

  if (isPending) {
    return (
      <>
        {toolbar}
        {filters}
        {LOADING_SKELETON}
      </>
    );
  }

  const showEndOfListCaption =
    infiniteScroll !== undefined &&
    items.length > 0 &&
    !infiniteScroll.hasNextPage &&
    !infiniteScroll.isFetchingNextPage;

  let body: ReactNode;
  if (items.length === 0) {
    body = (
      <TableBody>
        <TableRow>
          <TableCell className="text-muted-foreground" colSpan={colSpan}>
            {emptyMessage}
          </TableCell>
        </TableRow>
      </TableBody>
    );
  } else if (virtualization) {
    body = (
      <VirtualizedTableBody
        colSpan={colSpan}
        estimateRowHeight={virtualization.estimateRowHeight}
        getItemKey={getItemKey}
        items={items}
        overscan={virtualization.overscan}
        renderRow={renderRow}
        scrollElement={scrollElement}
      />
    );
  } else {
    body = <TableBody>{items.map((item, index) => renderRow(item, index))}</TableBody>;
  }

  return (
    <>
      {toolbar}
      {filters}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <DataTableHeadCell column={column} key={column.id} sort={sort} />
              ))}
            </TableRow>
          </TableHeader>
          {body}
          {infiniteScroll?.isFetchingNextPage ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={colSpan}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            </TableBody>
          ) : null}
          {footer && items.length > 0 ? <TableFooter>{footer}</TableFooter> : null}
        </Table>
        {infiniteScrollSentinelRef ? (
          <div aria-hidden className="h-px w-full" ref={infiniteScrollSentinelRef} />
        ) : null}
        {showEndOfListCaption ? (
          <p className="text-muted-foreground text-center text-sm">
            {getInfiniteListLoadMoreLabel({
              hasNextPage: false,
              isFetchingNextPage: false,
            })}
          </p>
        ) : null}
      </div>
    </>
  );
};
