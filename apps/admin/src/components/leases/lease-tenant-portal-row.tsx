import { type VariantProps } from "class-variance-authority";
import { memo } from "react";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ILeasePortalRowState,
  type TLeasePortalRowAction,
} from "@/lib/lease-portal-access-display";

interface ILeaseTenantPortalRowProps {
  actingAction: TLeasePortalRowAction | null;
  actingMembershipId: string | null;
  canManage: boolean;
  onInvite: () => void;
  onResend: () => void;
  onRevoke: () => void;
  portalState: ILeasePortalRowState;
}

function getPortalBadgeVariant(statusLabel: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (statusLabel) {
    case "Active":
      return "default";
    case "Invite pending":
      return "secondary";
    case "Not invited":
      return "outline";
    case "Declined":
    case "Revoked":
    case "Expired":
      return "destructive";
    default:
      return "outline";
  }
}

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
  const isActingOnRow = actingAction != null && actingMembershipId === membershipId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={getPortalBadgeVariant(portalState.statusLabel)}>
        {portalState.statusLabel}
      </Badge>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {portalState.actions.includes("invite") ? (
            <Button
              disabled={isActingOnRow}
              onClick={onInvite}
              size="sm"
              type="button"
              variant="outline"
            >
              {actingAction === "invite" && isActingOnRow ? "Inviting…" : "Invite"}
            </Button>
          ) : null}
          {portalState.actions.includes("resend") && membershipId ? (
            <Button
              disabled={isActingOnRow}
              onClick={onResend}
              size="sm"
              type="button"
              variant="outline"
            >
              {actingAction === "resend" && actingMembershipId === membershipId
                ? "Resending…"
                : "Resend"}
            </Button>
          ) : null}
          {portalState.actions.includes("revoke") && membershipId ? (
            <Button
              disabled={isActingOnRow}
              onClick={onRevoke}
              size="sm"
              type="button"
              variant="outline"
            >
              {actingAction === "revoke" && actingMembershipId === membershipId
                ? "Revoking…"
                : "Revoke"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
LeaseTenantPortalRow.displayName = "LeaseTenantPortalRow";
