import { memo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  type SupportRequestStatus,
  type TAdminSupportRequestSettableStatus,
} from "@/packages/shared";

const triageButtonClass = "cursor-pointer disabled:cursor-not-allowed";

export interface SupportTicketTriageActionsProps {
  busy: boolean;
  className?: string;
  layout?: "inline" | "stack";
  onPatchStatus: (status: TAdminSupportRequestSettableStatus) => void;
  status: SupportRequestStatus;
}

export const SupportTicketTriageActions = memo(
  ({
    busy,
    className,
    layout = "inline",
    onPatchStatus,
    status,
  }: SupportTicketTriageActionsProps) => {
    let content: ReactNode = null;

    if (status === "resolved") {
      content = <p className="text-muted-foreground text-sm">This request is resolved.</p>;
    } else if (status === "pending") {
      content = (
        <>
          <Button
            className={triageButtonClass}
            disabled={busy}
            onClick={() => onPatchStatus("in_progress")}
            size="sm"
            type="button"
            variant="secondary"
          >
            {busy ? "Saving…" : "Mark in progress"}
          </Button>
          <Button
            className={triageButtonClass}
            disabled={busy}
            onClick={() => onPatchStatus("resolved")}
            size="sm"
            type="button"
          >
            {busy ? "Saving…" : "Mark resolved"}
          </Button>
        </>
      );
    } else if (status === "in_progress") {
      content = (
        <Button
          className={triageButtonClass}
          disabled={busy}
          onClick={() => onPatchStatus("resolved")}
          size="sm"
          type="button"
        >
          {busy ? "Saving…" : "Mark resolved"}
        </Button>
      );
    }

    if (content == null) return null;

    return (
      <div
        className={
          layout === "stack"
            ? `flex flex-col gap-2 ${className ?? ""}`
            : `flex flex-wrap gap-2 ${className ?? ""}`
        }
      >
        {content}
      </div>
    );
  }
);
SupportTicketTriageActions.displayName = "SupportTicketTriageActions";
