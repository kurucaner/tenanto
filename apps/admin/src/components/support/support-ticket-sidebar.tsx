import { memo } from "react";
import { Link } from "react-router-dom";

import {
  supportDetailSectionLabelClass,
} from "@/components/support/support-constants";
import { SupportTicketTriageActions } from "@/components/support/support-ticket-triage-actions";
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
    <aside className="space-y-6">
      <section className="space-y-2">
        <h2 className={supportDetailSectionLabelClass}>Submitter</h2>
        <div className="space-y-1 text-sm">
          <p className="font-medium">{submitterName}</p>
          <Link
            className="text-primary underline-offset-2 hover:underline"
            to={`/users/${encodeURIComponent(ticketUserId)}`}
          >
            {submitterEmail}
          </Link>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className={supportDetailSectionLabelClass}>Triage</h2>
        <SupportTicketTriageActions
          busy={patchBusy}
          layout="stack"
          onPatchStatus={onPatchStatus}
          status={status}
        />
      </section>
    </aside>
  )
);
SupportTicketSidebar.displayName = "SupportTicketSidebar";
