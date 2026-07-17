import { memo, useCallback, useMemo } from "react";

import { PropertyMemberInviteStatusBadge } from "@/components/properties/property-member-invite-status-badge";
import { PropertyRoleBadge } from "@/components/properties/property-role-badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  getPropertyMemberInviteRowState,
  type TPropertyMemberInviteRowAction,
} from "@/lib/property-member-invite-display";
import { type IPropertyInvite } from "@/packages/shared";

interface IPropertyMemberInviteTableRowProps {
  actingAction: TPropertyMemberInviteRowAction | null;
  actingInviteId: string | null;
  canManageMembers: boolean;
  invite: IPropertyInvite;
  mutationPending: boolean;
  onInviteAgain: (invite: IPropertyInvite) => void;
  onResend: (invite: IPropertyInvite) => void;
  onRevoke: (invite: IPropertyInvite) => void;
  showActionsColumn: boolean;
}

const ACTION_LABEL: Record<
  TPropertyMemberInviteRowAction,
  { idle: string; pending: string; variant: "destructive" | "outline" }
> = {
  "invite-again": { idle: "Invite again", pending: "Inviting…", variant: "outline" },
  resend: { idle: "Resend", pending: "Resending…", variant: "outline" },
  revoke: { idle: "Revoke", pending: "Revoking…", variant: "destructive" },
};

export const PropertyMemberInviteTableRow = memo(function PropertyMemberInviteTableRow({
  actingAction,
  actingInviteId,
  canManageMembers,
  invite,
  mutationPending,
  onInviteAgain,
  onResend,
  onRevoke,
  showActionsColumn,
}: IPropertyMemberInviteTableRowProps) {
  const rowState = getPropertyMemberInviteRowState(invite);
  const isActingOnRow = actingInviteId === invite.id;

  const handleAction = useCallback(
    (action: TPropertyMemberInviteRowAction) => {
      if (action === "invite-again") {
        onInviteAgain(invite);
        return;
      }
      if (action === "resend") {
        onResend(invite);
        return;
      }
      onRevoke(invite);
    },
    [invite, onInviteAgain, onResend, onRevoke]
  );

  const actionButtons = useMemo(() => {
    if (!canManageMembers || rowState.actions.length === 0) {
      return null;
    }

    return rowState.actions.map((action) => {
      const labels = ACTION_LABEL[action];
      const isPending = mutationPending && actingAction === action && isActingOnRow;

      return (
        <Button
          className={action === "revoke" ? "text-destructive hover:text-destructive" : undefined}
          disabled={mutationPending}
          key={action}
          onClick={() => handleAction(action)}
          size="sm"
          type="button"
          variant={labels.variant}
        >
          {isPending ? labels.pending : labels.idle}
        </Button>
      );
    });
  }, [
    actingAction,
    canManageMembers,
    handleAction,
    isActingOnRow,
    mutationPending,
    rowState.actions,
  ]);

  return (
    <TableRow className="bg-muted/20">
      <TableCell>
        <div className="flex flex-col">
          <span className="text-muted-foreground font-medium italic">{invite.email}</span>
          <span className="text-muted-foreground text-xs">{rowState.statusLabel} invite</span>
        </div>
      </TableCell>
      <TableCell>
        <PropertyRoleBadge role={invite.role} />
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(invite.invitedAt).toLocaleString()}
      </TableCell>
      <TableCell>
        <PropertyMemberInviteStatusBadge invite={invite} />
      </TableCell>
      {showActionsColumn ? (
        <TableCell>
          {actionButtons ? <div className="flex items-center gap-2">{actionButtons}</div> : null}
        </TableCell>
      ) : null}
    </TableRow>
  );
});
PropertyMemberInviteTableRow.displayName = "PropertyMemberInviteTableRow";
