import { isPostgresUniqueViolation } from "@/db/pg-errors";
import { propertiesDb } from "@/db/properties";
import { propertyInvitesDb } from "@/db/property-invites";
import { propertyMembersDb } from "@/db/property-members";
import { userDb } from "@/db/users";
import {
  propertyMemberInviteInvalidStateError,
  propertyMemberInviteNotFoundError,
} from "@/errors/property-member-invite-errors";
import { buildPropertyMemberInviteSummary } from "@/lib/build-property-member-invite-summary";
import { formatPropertyRoleLabel } from "@/lib/format-property-role-label";
import {
  type IPropertyInvite,
  type IPropertyMember,
  type IPropertyPendingMemberInvite,
  type IUser,
  PropertyInviteStatus,
} from "@/packages/shared";
import { notifyUser } from "@/services/user-notifications";

import {
  logPropertyMemberInviteAccepted,
  logPropertyMemberInviteDeclined,
} from "./property-member-invite-observability";

const ACCEPTABLE_STATUSES = new Set<string>([
  PropertyInviteStatus.PENDING,
  PropertyInviteStatus.PENDING_INVITE,
  PropertyInviteStatus.PENDING_ACCEPTANCE,
]);

function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertInviteMatchesUser(invite: IPropertyInvite, user: IUser): void {
  if (normalizeInviteEmail(invite.email) !== normalizeInviteEmail(user.email)) {
    throw propertyMemberInviteInvalidStateError(
      "This invite was sent to a different email address"
    );
  }
}

async function assertInviteActionable(invite: IPropertyInvite): Promise<void> {
  if (
    invite.status === PropertyInviteStatus.DECLINED ||
    invite.status === PropertyInviteStatus.EXPIRED
  ) {
    throw propertyMemberInviteInvalidStateError(
      "This invite is no longer available. Ask the property owner to resend."
    );
  }

  if (!ACCEPTABLE_STATUSES.has(invite.status)) {
    throw propertyMemberInviteInvalidStateError("This invite is no longer available");
  }

  const expired = await propertyInvitesDb.expireInviteIfPastTtl(invite);
  if (expired) {
    throw propertyMemberInviteInvalidStateError("This invite has expired");
  }
}

async function loadPendingInviteItem(
  invite: IPropertyInvite
): Promise<IPropertyPendingMemberInvite | null> {
  const property = await propertiesDb.findById(invite.propertyId);
  if (!property) {
    return null;
  }

  const inviter = await userDb.findById(invite.invitedBy);
  if (!inviter) {
    return null;
  }

  return {
    expiresAt: invite.expiresAt,
    inviteId: invite.id,
    propertyId: invite.propertyId,
    propertyName: property.name,
    role: invite.role,
    roleLabel: formatPropertyRoleLabel(invite.role),
    status: invite.status,
    summary: buildPropertyMemberInviteSummary(invite, property, inviter),
  };
}

async function acceptInviteForUser(
  invite: IPropertyInvite,
  user: IUser
): Promise<{ invite: IPropertyInvite; member: IPropertyMember }> {
  assertInviteMatchesUser(invite, user);

  if (invite.status === PropertyInviteStatus.ACCEPTED) {
    const existingMember = await propertyMembersDb.findOne(invite.propertyId, user.id);
    if (existingMember) {
      return { invite, member: existingMember };
    }
  }

  await assertInviteActionable(invite);

  let member = await propertyMembersDb.findOne(invite.propertyId, user.id);
  if (!member) {
    try {
      member = await propertyMembersDb.add(
        invite.propertyId,
        user.id,
        invite.role,
        invite.invitedBy
      );
    } catch (error) {
      if (!isPostgresUniqueViolation(error)) {
        throw error;
      }
      member = await propertyMembersDb.findOne(invite.propertyId, user.id);
      if (!member) {
        throw error;
      }
    }
  }

  let updatedInvite = invite;
  if (invite.status !== PropertyInviteStatus.ACCEPTED) {
    const transitioned = await propertyInvitesDb.transitionStatus(
      invite.id,
      PropertyInviteStatus.ACCEPTED
    );
    if (!transitioned) {
      throw propertyMemberInviteNotFoundError("Property member invite not found");
    }
    updatedInvite = transitioned;
  }

  logPropertyMemberInviteAccepted(updatedInvite);

  const property = await propertiesDb.findById(invite.propertyId);
  if (property) {
    notifyUser({
      body: `You were added as ${formatPropertyRoleLabel(invite.role)}.`,
      resourceId: invite.propertyId,
      resourceType: "property",
      title: `Added to ${property.name}`,
      type: "property_member_added",
      userId: user.id,
    }).catch(() => {});
  }

  return { invite: updatedInvite, member };
}

export const propertyMemberInviteActionService = {
  async acceptInvite(
    inviteId: string,
    user: IUser
  ): Promise<{ invite: IPropertyInvite; member: IPropertyMember }> {
    const invite = await propertyInvitesDb.findById(inviteId);
    if (!invite) {
      throw propertyMemberInviteNotFoundError("Property member invite not found");
    }
    return acceptInviteForUser(invite, user);
  },

  async declineInvite(inviteId: string, user: IUser): Promise<IPropertyInvite> {
    const invite = await propertyInvitesDb.findById(inviteId);
    if (!invite) {
      throw propertyMemberInviteNotFoundError("Property member invite not found");
    }

    await assertInviteActionable(invite);
    assertInviteMatchesUser(invite, user);

    const updated = await propertyInvitesDb.transitionStatus(
      invite.id,
      PropertyInviteStatus.DECLINED
    );
    if (!updated) {
      throw propertyMemberInviteNotFoundError("Property member invite not found");
    }
    logPropertyMemberInviteDeclined(updated);
    return updated;
  },

  async listPendingInvites(user: IUser): Promise<IPropertyPendingMemberInvite[]> {
    const invites = await propertyInvitesDb.findPendingByEmail(user.email);
    const items = await Promise.all(invites.map((invite) => loadPendingInviteItem(invite)));
    return items.filter((item): item is IPropertyPendingMemberInvite => item != null);
  },

  async redeemInvite(
    token: string,
    user: IUser
  ): Promise<{ invite: IPropertyInvite; member: IPropertyMember }> {
    const invite = await propertyInvitesDb.findByInviteToken(token);
    if (!invite) {
      throw propertyMemberInviteNotFoundError("Invalid or expired invite link");
    }
    return acceptInviteForUser(invite, user);
  },
};
