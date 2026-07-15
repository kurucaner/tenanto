import { memo, type ReactNode, type RefObject, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import {
  type DataTableColumn,
  type DataTableSortController,
} from "@/components/data-table/data-table-types";
import { SupportStatusBadge } from "@/components/support/support-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { type IAdminSupportRequestListItem, type ISupportRequestListItem } from "@/packages/shared";

type TSupportTableRow = ISupportRequestListItem | IAdminSupportRequestListItem;

const USER_COLUMNS: DataTableColumn[] = [
  { id: "createdAt", label: "Created", sortable: true },
  { id: "category", label: "Category", sortable: true },
  { id: "status", label: "Status", sortable: true },
  { id: "latestMessage", label: "Latest message" },
  { id: "updatedAt", label: "Updated", sortable: true },
];

const ADMIN_COLUMNS: DataTableColumn[] = [
  ...USER_COLUMNS.slice(0, 3),
  { id: "submitter", label: "Submitter" },
  ...USER_COLUMNS.slice(3),
];

const SUPPORT_REQUEST_ROW_ESTIMATED_HEIGHT = 76;

function isAdminRow(row: TSupportTableRow): row is IAdminSupportRequestListItem {
  return "submitterEmail" in row;
}

function getSupportRequestKey(row: TSupportTableRow): string {
  return row.id;
}

const SupportRequestTableRow = memo(
  ({ row, variant }: Readonly<{ row: TSupportTableRow; variant: "admin" | "user" }>) => {
    const navigate = useNavigate();
    const showReplyHighlight =
      row.status !== "resolved" &&
      (variant === "admin" ? row.lastMessageFromSubmitter : !row.lastMessageFromSubmitter);

    return (
      <TableRow
        className="cursor-pointer"
        onClick={() => navigate(`/support-requests/${encodeURIComponent(row.id)}`)}
      >
        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </TableCell>
        <TableCell>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.category}</span>
        </TableCell>
        <TableCell>
          <SupportStatusBadge status={row.status} />
        </TableCell>
        {variant === "admin" && isAdminRow(row) ? (
          <TableCell className="max-w-[200px]">
            <div className="font-medium leading-tight">{row.submitterName}</div>
            <Link
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
              to={`/users/${encodeURIComponent(row.userId)}`}
            >
              {row.submitterEmail}
            </Link>
          </TableCell>
        ) : null}
        <TableCell className="max-w-[min(20rem,36vw)]">
          <div className="flex flex-wrap items-start gap-2">
            <p
              className={
                showReplyHighlight
                  ? "line-clamp-2 whitespace-pre-wrap break-words font-medium text-foreground"
                  : "text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words"
              }
            >
              {row.lastMessagePreview}
            </p>
            {variant === "admin" && row.lastMessageFromSubmitter && row.status !== "resolved" ? (
              <Badge className="shrink-0" variant="outline">
                Needs reply
              </Badge>
            ) : null}
            {variant === "user" && !row.lastMessageFromSubmitter && row.status !== "resolved" ? (
              <Badge className="shrink-0" variant="outline">
                New reply
              </Badge>
            ) : null}
          </div>
          {row.messageCount > 1 ? (
            <p className="text-muted-foreground mt-1 text-xs">{row.messageCount} messages</p>
          ) : null}
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(row.updatedAt).toLocaleString()}
        </TableCell>
      </TableRow>
    );
  }
);
SupportRequestTableRow.displayName = "SupportRequestTableRow";

export const SupportRequestsTable = memo(
  ({
    emptyMessage,
    hasNextPage,
    infiniteScrollSentinelRef,
    isFetchingNextPage,
    isPending,
    isRefreshing,
    rows,
    sort,
    toolbar,
    variant,
  }: {
    emptyMessage: string;
    hasNextPage: boolean;
    infiniteScrollSentinelRef: RefObject<HTMLDivElement | null>;
    isFetchingNextPage: boolean;
    isPending: boolean;
    isRefreshing: boolean;
    rows: TSupportTableRow[];
    sort: DataTableSortController;
    toolbar: ReactNode;
    variant: "admin" | "user";
  }) => {
    const renderRow = useCallback(
      (row: TSupportTableRow) => (
        <SupportRequestTableRow key={row.id} row={row} variant={variant} />
      ),
      [variant]
    );

    return (
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <DataTable
            columns={variant === "admin" ? ADMIN_COLUMNS : USER_COLUMNS}
            emptyMessage={emptyMessage}
            getItemKey={getSupportRequestKey}
            infiniteScroll={{ hasNextPage, isFetchingNextPage }}
            infiniteScrollSentinelRef={infiniteScrollSentinelRef}
            isPending={isPending}
            isRefreshing={isRefreshing}
            items={rows}
            renderRow={renderRow}
            sort={sort}
            toolbar={toolbar}
            virtualization={{ estimateRowHeight: SUPPORT_REQUEST_ROW_ESTIMATED_HEIGHT }}
          />
        </CardContent>
      </Card>
    );
  }
);
SupportRequestsTable.displayName = "SupportRequestsTable";
