import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { SupportStatusBadge } from "@/components/support/support-status-badge";
import { SupportTicketTriageActions } from "@/components/support/support-ticket-triage-actions";
import { Badge } from "@/components/ui/badge";
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
  createdAt: string;
  id: string;
  isAdmin: boolean;
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          streamStatus === "connected"
            ? "animate-pulse bg-emerald-500"
            : "bg-amber-500"
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
    createdAt,
    id,
    isAdmin,
    onPatchStatus,
    patchBusy,
    status,
  }: SupportTicketHeaderProps) => {
    let mobileTriage: ReactNode = null;
    if (isAdmin) {
      mobileTriage = (
        <SupportTicketTriageActions
          busy={patchBusy}
          className="lg:hidden"
          onPatchStatus={onPatchStatus}
          status={status}
        />
      );
    }

    return (
      <div className="sticky top-0 z-10 space-y-3 border-b border-border/60 bg-card/90 px-4 py-4 backdrop-blur-md md:px-5">
        <Link className="text-muted-foreground text-sm hover:underline" to="/support-requests">
          ← Support requests
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={status} />
          <Badge variant="outline">{formatSupportCategoryLabel(category)}</Badge>
          <LiveIndicator />
          <span className="text-muted-foreground text-xs">
            Opened {new Date(createdAt).toLocaleString()}
          </span>
        </div>

        <p className="font-mono text-xs text-muted-foreground">{id}</p>

        {mobileTriage}
      </div>
    );
  }
);
SupportTicketHeader.displayName = "SupportTicketHeader";
