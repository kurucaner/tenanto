import { formatPropertyRoleLabel } from "@/lib/format-property-role-label";
import { type IProperty, type IPropertyInvite, type IUser } from "@/packages/shared";
import { notifyUser } from "@/services/user-notifications";

export async function notifyPropertyMemberInviteReceived(input: {
  invite: IPropertyInvite;
  invitee: IUser;
  property: IProperty;
}): Promise<void> {
  await notifyUser({
    body: `You've been invited as ${formatPropertyRoleLabel(input.invite.role)}. Accept to join this property team.`,
    contextResourceId: input.invite.id,
    resourceId: input.invite.propertyId,
    resourceType: "property",
    title: `Invitation to ${input.property.name}`,
    type: "property_member_invite_received",
    userId: input.invitee.id,
  });
}
