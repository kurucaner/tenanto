import { memo } from "react";
import { Link } from "react-router-dom";

import { supportDetailSectionLabelClass } from "@/components/support/support-constants";

export interface SupportTicketSidebarProps {
  submitterEmail: string;
  submitterName: string;
  ticketUserId: string;
}

export const SupportTicketSidebar = memo(
  ({ submitterEmail, submitterName, ticketUserId }: SupportTicketSidebarProps) => (
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
    </aside>
  )
);
SupportTicketSidebar.displayName = "SupportTicketSidebar";
