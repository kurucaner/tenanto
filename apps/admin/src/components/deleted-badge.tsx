import { DollarSign, RotateCcw } from "lucide-react";
import { memo } from "react";

import { TableIconButton } from "@/components/table/table-icon-button";
import { Badge } from "@/components/ui/badge";

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
    <TableIconButton ariaLabel={ariaLabel} onClick={onClick} tooltip={ariaLabel}>
      <RotateCcw className="size-3.5" />
    </TableIconButton>
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
    <TableIconButton
      ariaLabel={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      tooltip={ariaLabel}
    >
      {isRefunded ? <RotateCcw className="size-3.5" /> : <DollarSign className="size-3.5" />}
    </TableIconButton>
  )
);
RefundEntityButton.displayName = "RefundEntityButton";
