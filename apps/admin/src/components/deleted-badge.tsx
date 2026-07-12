import { Receipt, RotateCcw } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Marks a soft-deleted row. Only platform admins ever see deleted rows; the
 * row itself is dimmed (see `deletedRowClassName` in `ledger-entry-row-styles`)
 * and this badge labels it.
 */
export const DeletedBadge = memo(() => (
  <Badge className="uppercase" variant="destructive">
    Deleted
  </Badge>
));
DeletedBadge.displayName = "DeletedBadge";

export const RefundedBadge = memo(() => (
  <Badge className="uppercase" variant="secondary">
    Refunded
  </Badge>
));
RefundedBadge.displayName = "RefundedBadge";

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
