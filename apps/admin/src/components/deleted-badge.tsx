import { Receipt, RotateCcw } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Marks a soft-deleted row. Only platform admins ever see deleted rows; the
 * row itself is dimmed (see `deletedRowClassName`) and this badge labels it.
 */
export const DeletedBadge = memo(() => (
  <Badge className="uppercase" variant="destructive">
    Deleted
  </Badge>
));
DeletedBadge.displayName = "DeletedBadge";

/** Applied to a soft-deleted `<TableRow>` to visually de-emphasize it. */
export const deletedRowClassName = "opacity-55";

export const RefundedBadge = memo(() => (
  <Badge className="uppercase" variant="secondary">
    Refunded
  </Badge>
));
RefundedBadge.displayName = "RefundedBadge";

/** Applied to a refunded (non-deleted) `<TableRow>` to visually de-emphasize it. */
export const refundedRowClassName = "opacity-80";

export function ledgerEntryRowClassName(
  isDeleted: boolean,
  refundedAt: string | null
): string | undefined {
  if (isDeleted) return deletedRowClassName;
  if (refundedAt) return refundedRowClassName;
  return undefined;
}

export const RestoreEntityButton = memo(
  ({ ariaLabel, onClick }: { ariaLabel: string; onClick: () => void }) => (
    <Button aria-label={ariaLabel} onClick={onClick} size="icon-sm" type="button" variant="ghost">
      <RotateCcw className="size-3.5" />
    </Button>
  )
);
RestoreEntityButton.displayName = "RestoreEntityButton";

export const RefundEntityButton = memo(
  ({
    ariaLabel,
    disabled = false,
    isRefunded,
    onClick,
  }: {
    ariaLabel: string;
    disabled?: boolean;
    isRefunded: boolean;
    onClick: () => void;
  }) => (
    <Button
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      {isRefunded ? <RotateCcw className="size-3.5" /> : <Receipt className="size-3.5" />}
    </Button>
  )
);
RefundEntityButton.displayName = "RefundEntityButton";
