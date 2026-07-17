import { type IPropertyPendingMemberInvite } from "@/packages/shared";

export function parseAcceptInviteSearchParams(searchParams: URLSearchParams): {
  inviteId: string;
  token: string;
} {
  return {
    inviteId: searchParams.get("inviteId")?.trim() ?? "",
    token: searchParams.get("token")?.trim() ?? "",
  };
}

export function findPendingMemberInviteById(
  invites: IPropertyPendingMemberInvite[],
  inviteId: string
): IPropertyPendingMemberInvite | undefined {
  if (inviteId === "") {
    return undefined;
  }
  return invites.find((invite) => invite.inviteId === inviteId);
}
