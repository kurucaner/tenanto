import { memo, useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  type ILeasePortalRowState,
  type TLeasePortalRowAction,
  type TLeasePortalStatusTone,
} from "@/lib/lease-portal-access-display";
import { cn } from "@/lib/utils";

interface ILeaseTenantPortalRowProps {
  actingAction: TLeasePortalRowAction | null;
  actingMembershipId: string | null;
  canManage: boolean;
  onInvite: () => void;
  onResend: () => void;
  onRevoke: () => void;
  portalState: ILeasePortalRowState;
}

const STATUS_DOT_CLASS: Record<TLeasePortalStatusTone, string> = {
  active: "bg-emerald-500",
  muted: "bg-muted-foreground/40",
  neutral: "bg-muted-foreground/35",
  pending: "bg-amber-500",
};

const ACTION_LABEL: Record<TLeasePortalRowAction, { idle: string; pending: string }> = {
  invite: { idle: "Invite", pending: "Inviting…" },
  resend: { idle: "Resend", pending: "Resending…" },
  revoke: { idle: "Revoke", pending: "Revoking…" },
};

export const LeaseTenantPortalRow = memo(function LeaseTenantPortalRow({
  actingAction,
  actingMembershipId,
  canManage,
  onInvite,
  onResend,
  onRevoke,
  portalState,
}: ILeaseTenantPortalRowProps) {
  const membershipId = portalState.membership?.id ?? null;
  const action = portalState.actions[0] ?? null;
  const isActingOnRow = actingAction != null && actingMembershipId === membershipId;
  const showAction = canManage && action != null && (action === "invite" || membershipId != null);

  const handleAction = useCallback(() => {
    if (action === "invite") {
      onInvite();
      return;
    }
    if (action === "resend") {
      onResend();
      return;
    }
    if (action === "revoke") {
      onRevoke();
    }
  }, [action, onInvite, onResend, onRevoke]);

  const buttonVariant = useMemo(() => {
    return action === "revoke" ? "destructive" : "outline";
  }, [action]);

  const buttonClassName = useMemo(() => {
    return action === "revoke" ? "text-destructive hover:text-destructive" : undefined;
  }, [action]);

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASS[portalState.statusTone])}
        />
        {portalState.statusLabel}
      </span>
      {showAction && action ? (
        <Button
          className={buttonClassName}
          disabled={isActingOnRow}
          onClick={handleAction}
          size="sm"
          type="button"
          variant={buttonVariant}
        >
          {actingAction === action && isActingOnRow
            ? ACTION_LABEL[action].pending
            : ACTION_LABEL[action].idle}
        </Button>
      ) : null}
    </div>
  );
});
LeaseTenantPortalRow.displayName = "LeaseTenantPortalRow";
