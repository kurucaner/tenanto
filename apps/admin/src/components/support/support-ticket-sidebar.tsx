import { memo } from "react";
import { Link } from "react-router-dom";

import { SupportTicketTriageActions } from "@/components/support/support-ticket-triage-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type SupportRequestStatus,
  type TAdminSupportRequestSettableStatus,
} from "@/packages/shared";

export interface SupportTicketSidebarProps {
  patchBusy: boolean;
  status: SupportRequestStatus;
  submitterEmail: string;
  submitterName: string;
  ticketUserId: string;
  onPatchStatus: (status: TAdminSupportRequestSettableStatus) => void;
}

export const SupportTicketSidebar = memo(
  ({
    onPatchStatus,
    patchBusy,
    status,
    submitterEmail,
    submitterName,
    ticketUserId,
  }: SupportTicketSidebarProps) => (
    <aside className="space-y-4">
      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Submitter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{submitterName}</p>
          <Link
            className="text-primary underline-offset-2 hover:underline"
            to={`/users/${encodeURIComponent(ticketUserId)}`}
          >
            {submitterEmail}
          </Link>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Triage</CardTitle>
        </CardHeader>
        <CardContent>
          <SupportTicketTriageActions
            busy={patchBusy}
            layout="stack"
            onPatchStatus={onPatchStatus}
            status={status}
          />
        </CardContent>
      </Card>
    </aside>
  )
);
SupportTicketSidebar.displayName = "SupportTicketSidebar";
