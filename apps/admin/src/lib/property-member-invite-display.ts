import {
  type IPropertyInvite,
  isPendingPropertyMemberInviteStatus,
  PropertyInviteStatus,
  type TPropertyInviteStatus,
} from "@/packages/shared";

export type TPropertyMemberInviteRowAction = "invite-again" | "resend" | "revoke";

export type TPropertyMemberInviteStatusTone = "muted" | "pending" | "warning";

export interface IPropertyMemberInviteRowState {
  actions: TPropertyMemberInviteRowAction[];
  statusLabel: string;
  statusTone: TPropertyMemberInviteStatusTone;
}

export function formatPropertyMemberInviteAdminStatus(status: TPropertyInviteStatus): string {
  if (isPendingPropertyMemberInviteStatus(status)) {
    return "Pending";
  }

  switch (status) {
    case PropertyInviteStatus.EMAIL_FAILED:
      return "Email failed";
    case PropertyInviteStatus.DECLINED:
      return "Declined";
    case PropertyInviteStatus.REVOKED:
      return "Revoked";
    case PropertyInviteStatus.EXPIRED:
      return "Expired";
    default:
      return status;
  }
}

export function getPropertyMemberInviteStatusTone(
  statusLabel: string
): TPropertyMemberInviteStatusTone {
  switch (statusLabel) {
    case "Pending":
      return "pending";
    case "Email failed":
      return "warning";
    case "Declined":
    case "Expired":
    case "Revoked":
      return "muted";
    default:
      return "muted";
  }
}

export function getPropertyMemberInviteRowState(
  invite: IPropertyInvite
): IPropertyMemberInviteRowState {
  const statusLabel = formatPropertyMemberInviteAdminStatus(invite.status);
  const actions: TPropertyMemberInviteRowAction[] = [];

  if (
    isPendingPropertyMemberInviteStatus(invite.status) ||
    invite.status === PropertyInviteStatus.EMAIL_FAILED
  ) {
    actions.push("resend", "revoke");
  } else if (
    invite.status === PropertyInviteStatus.DECLINED ||
    invite.status === PropertyInviteStatus.REVOKED ||
    invite.status === PropertyInviteStatus.EXPIRED
  ) {
    actions.push("invite-again");
  }

  return {
    actions,
    statusLabel,
    statusTone: getPropertyMemberInviteStatusTone(statusLabel),
  };
}
