import { memo } from "react";

import { Button } from "@/components/ui/button";
import { type SupportRequestStatus } from "@/packages/shared";

export interface SupportTicketUserActionsProps {
  busy: boolean;
  onClose: () => void;
  status: SupportRequestStatus;
}

export const SupportTicketUserActions = memo(
  ({ busy, onClose, status }: SupportTicketUserActionsProps) => {
    if (status === "resolved") {
      return <p className="text-muted-foreground text-sm">This request is resolved.</p>;
    }

    return (
      <Button
        className="cursor-pointer disabled:cursor-not-allowed"
        disabled={busy}
        onClick={onClose}
        size="sm"
        type="button"
        variant="secondary"
      >
        {busy ? "Closing…" : "Close ticket"}
      </Button>
    );
  }
);
SupportTicketUserActions.displayName = "SupportTicketUserActions";
