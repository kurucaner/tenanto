import type { IPropertyInvite } from "@/packages/shared";

import { WinstonLogger } from "./winston";

export interface IPropertyMemberInviteLogContext {
  inviteEmail: string;
  inviteId: string;
  propertyId: string;
  status: IPropertyInvite["status"];
}

export function buildPropertyMemberInviteLogContext(
  invite: Pick<IPropertyInvite, "email" | "id" | "propertyId" | "status">
): IPropertyMemberInviteLogContext {
  return {
    inviteEmail: invite.email.trim().toLowerCase(),
    inviteId: invite.id,
    propertyId: invite.propertyId,
    status: invite.status,
  };
}

export function logPropertyMemberInviteInvited(
  invite: IPropertyInvite,
  meta: { emailSent: boolean }
): void {
  WinstonLogger.info("property_member_invite.invited", {
    ...buildPropertyMemberInviteLogContext(invite),
    emailSent: meta.emailSent,
  });
}

export function logPropertyMemberInviteResent(
  invite: IPropertyInvite,
  meta: { emailSent: boolean }
): void {
  WinstonLogger.info("property_member_invite.resent", {
    ...buildPropertyMemberInviteLogContext(invite),
    emailSent: meta.emailSent,
  });
}

export function logPropertyMemberInviteRevoked(invite: IPropertyInvite): void {
  WinstonLogger.info("property_member_invite.revoked", buildPropertyMemberInviteLogContext(invite));
}

export function logPropertyMemberInviteAccepted(invite: IPropertyInvite): void {
  WinstonLogger.info(
    "property_member_invite.accepted",
    buildPropertyMemberInviteLogContext(invite)
  );
}

export function logPropertyMemberInviteDeclined(invite: IPropertyInvite): void {
  WinstonLogger.info(
    "property_member_invite.declined",
    buildPropertyMemberInviteLogContext(invite)
  );
}
