import { memo } from "react";
import { Link, useNavigate } from "react-router-dom";

import { SupportStatusBadge } from "@/components/support/support-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type IAdminSupportRequestListItem, type ISupportRequestListItem } from "@/packages/shared";

type TSupportTableRow = ISupportRequestListItem | IAdminSupportRequestListItem;

function isAdminRow(row: TSupportTableRow): row is IAdminSupportRequestListItem {
  return "submitterEmail" in row;
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
    rows,
    variant,
  }: Readonly<{
    rows: TSupportTableRow[];
    variant: "admin" | "user";
  }>) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            {variant === "admin" ? <TableHead>Submitter</TableHead> : null}
            <TableHead>Latest message</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <SupportRequestTableRow key={row.id} row={row} variant={variant} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
);
SupportRequestsTable.displayName = "SupportRequestsTable";
