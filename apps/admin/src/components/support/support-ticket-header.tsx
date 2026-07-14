import { memo } from "react";
import { Link } from "react-router-dom";

import { supportDetailMetaClass } from "@/components/support/support-constants";
import { SupportStatusBadge } from "@/components/support/support-status-badge";
import { SupportTicketTriageActions } from "@/components/support/support-ticket-triage-actions";
import { SupportTicketUserActions } from "@/components/support/support-ticket-user-actions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNotificationStreamStatus } from "@/contexts/notification-stream-context";
import { type NotificationStreamStatus } from "@/hooks/use-notification-stream";
import { formatSupportCategoryLabel } from "@/lib/format-support-category-label";
import { cn } from "@/lib/utils";
import {
  type SupportCategory,
  type SupportRequestStatus,
  type TAdminSupportRequestSettableStatus,
} from "@/packages/shared";

export interface SupportTicketHeaderProps {
  category: SupportCategory;
  closeBusy: boolean;
  createdAt: string;
  id: string;
  isAdmin: boolean;
  onClose: () => void;
  onPatchStatus: (status: TAdminSupportRequestSettableStatus) => void;
  patchBusy: boolean;
  status: SupportRequestStatus;
}

function getLiveIndicatorLabel(streamStatus: NotificationStreamStatus): string | null {
  if (streamStatus === "idle") return null;
  if (streamStatus === "connected") return "Live";
  if (streamStatus === "connecting") return "Connecting…";
  return "Reconnecting…";
}

const LiveIndicator = memo(() => {
  const streamStatus = useNotificationStreamStatus();
  const label = getLiveIndicatorLabel(streamStatus);

  if (label == null) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          streamStatus === "connected" ? "animate-pulse bg-emerald-500" : "bg-amber-500"
        )}
      />
      {label}
    </span>
  );
});
LiveIndicator.displayName = "SupportTicketLiveIndicator";

export const SupportTicketHeader = memo(
  ({
    category,
    closeBusy,
    createdAt,
    id,
    isAdmin,
    onClose,
    onPatchStatus,
    patchBusy,
    status,
  }: SupportTicketHeaderProps) => {
    const openedLabel = new Date(createdAt).toLocaleString();
    const ticketIdLabel = id.length > 12 ? `${id.slice(0, 8)}…` : id;

    return (
      <div className={cn("sticky top-0 z-10 space-y-2 pb-3", supportDetailMetaClass)}>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="text-muted-foreground shrink-0 text-sm hover:underline"
            to="/support-requests"
          >
            ← Support requests
          </Link>

          <Separator className="hidden h-4 sm:block" orientation="vertical" />

          <div className="flex flex-wrap items-center gap-2">
            <SupportStatusBadge status={status} />
            <Badge variant="outline">{formatSupportCategoryLabel(category)}</Badge>
            <LiveIndicator />
          </div>

          <div className="ml-auto flex min-h-8 items-center gap-2">
            {isAdmin ? (
              <SupportTicketTriageActions
                busy={patchBusy}
                onPatchStatus={onPatchStatus}
                status={status}
              />
            ) : (
              <SupportTicketUserActions busy={closeBusy} onClose={onClose} status={status} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span title={openedLabel}>Opened {openedLabel}</span>
          <span aria-hidden className="text-muted-foreground/30">
            ·
          </span>
          <span className="font-mono text-[11px]" title={id}>
            {ticketIdLabel}
          </span>
        </div>
      </div>
    );
  }
);
SupportTicketHeader.displayName = "SupportTicketHeader";
