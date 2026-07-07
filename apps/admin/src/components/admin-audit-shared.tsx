import { memo } from "react";
import { Link } from "react-router-dom";

import { formatAdminAuditAction } from "@/lib/admin-audit-format";
import type { IAdminAuditEvent } from "@/packages/shared";

export const AuditDiffSnippet = memo(({ event }: { event: IAdminAuditEvent }) => {
  const meta = event.metadata;
  const before = meta.before as Record<string, unknown> | undefined;
  const after = meta.after as Record<string, unknown> | undefined;
  if (before == null && after == null) {
    return null;
  }
  const text = JSON.stringify({ after, before }, null, 2);
  return (
    <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2 font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
      {text}
    </pre>
  );
});
AuditDiffSnippet.displayName = "AuditDiffSnippet";

export const AdminAuditEventDetails = memo(
  ({
    event,
    showUserResourceLink = false,
  }: {
    event: IAdminAuditEvent;
    showUserResourceLink?: boolean;
  }) => (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{formatAdminAuditAction(event.action)}</p>
      <p className="text-muted-foreground text-xs">
        {new Date(event.createdAt).toLocaleString()} · {event.actorEmail}
        {event.ipAddress != null ? ` · ${event.ipAddress}` : null}
      </p>
      {showUserResourceLink && event.resourceType === "user" && event.resourceId != null ? (
        <Link
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          to={`/users/${event.resourceId}`}
        >
          Open affected user
        </Link>
      ) : null}
      <AuditDiffSnippet event={event} />
    </div>
  )
);
AdminAuditEventDetails.displayName = "AdminAuditEventDetails";
