import type {
  IProperty,
  IPropertyInvite,
  IPropertyMemberInviteSummary,
  IUser,
} from "@/packages/shared";

import { formatPropertyRoleLabel } from "./format-property-role-label";

export function buildPropertyMemberInviteSummary(
  invite: IPropertyInvite,
  property: IProperty,
  inviter: IUser
): IPropertyMemberInviteSummary {
  return {
    inviterEmail: inviter.email,
    inviterName: inviter.name,
    propertyAddress: property.address,
    propertyName: property.name,
    role: invite.role,
    roleLabel: formatPropertyRoleLabel(invite.role),
  };
}
