import {
  type IPropertyInvite,
  isPendingPropertyMemberInviteStatus,
  PropertyInviteStatus,
  type TPropertyInviteStatus,
} from "@/packages/shared";

export type TPropertyMemberInviteStatusTone = "muted" | "pending" | "warning";

export interface IPropertyMemberInviteRowState {
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
    default:
      return "muted";
  }
}

export function getPropertyMemberInviteRowState(
  invite: IPropertyInvite
): IPropertyMemberInviteRowState {
  const statusLabel = formatPropertyMemberInviteAdminStatus(invite.status);
  return {
    statusLabel,
    statusTone: getPropertyMemberInviteStatusTone(statusLabel),
  };
}
