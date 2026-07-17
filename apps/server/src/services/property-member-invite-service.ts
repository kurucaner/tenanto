import { propertiesDb } from "@/db/properties";
import { DuplicatePropertyMemberInviteError, propertyInvitesDb } from "@/db/property-invites";
import { userDb } from "@/db/users";
import { buildPropertyMemberInviteSummary } from "@/lib/build-property-member-invite-summary";
import {
  type ICreatePropertyMemberInviteResult,
  type IProperty,
  type IPropertyInvite,
  type IPropertyInvitePreviewResponse,
  isPendingPropertyMemberInviteStatus,
  PropertyInviteStatus,
  type TPropertyRole,
} from "@/packages/shared";
import {
  buildPropertyMemberInviteAcceptUrl,
  generatePropertyMemberInviteToken,
  hashPropertyMemberInviteToken,
} from "@/ses/property-member-invite-token";
import {
  sendPropertyMemberInviteExistingEmail,
  sendPropertyMemberInviteNewEmail,
} from "@/ses/transactional-emails";

import {
  logPropertyMemberInviteInvited,
  logPropertyMemberInviteResent,
  logPropertyMemberInviteRevoked,
} from "./property-member-invite-observability";

export class PropertyMemberInviteNotFoundError extends Error {
  constructor(message = "Property member invite not found") {
    super(message);
    this.name = "PropertyMemberInviteNotFoundError";
  }
}

export class PropertyMemberInviteMismatchError extends Error {
  constructor(message = "Property member invite does not belong to this property") {
    super(message);
    this.name = "PropertyMemberInviteMismatchError";
  }
}

export class PropertyMemberInviteInvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyMemberInviteInvalidStateError";
  }
}

const PENDING_PREVIEW_STATUSES = new Set<string>([
  PropertyInviteStatus.PENDING,
  PropertyInviteStatus.PENDING_INVITE,
  PropertyInviteStatus.PENDING_ACCEPTANCE,
]);

async function resolveInitialStatus(
  inviteEmail: string
): Promise<
  typeof PropertyInviteStatus.PENDING_INVITE | typeof PropertyInviteStatus.PENDING_ACCEPTANCE
> {
  const existingUser = await userDb.findByEmail(inviteEmail);
  return existingUser
    ? PropertyInviteStatus.PENDING_ACCEPTANCE
    : PropertyInviteStatus.PENDING_INVITE;
}

async function sendPropertyMemberInviteEmail(
  invite: IPropertyInvite,
  property: IProperty,
  inviter: NonNullable<Awaited<ReturnType<typeof userDb.findById>>>,
  rawToken: string,
  hasExistingAccount: boolean
): Promise<{ emailError?: string; emailSent: boolean }> {
  const acceptUrl = buildPropertyMemberInviteAcceptUrl(rawToken);
  const summary = buildPropertyMemberInviteSummary(invite, property, inviter);

  try {
    const emailSent = hasExistingAccount
      ? await sendPropertyMemberInviteExistingEmail(invite.email, {
          acceptUrl,
          inviterName: summary.inviterName,
          propertyName: summary.propertyName,
          roleLabel: summary.roleLabel,
        })
      : await sendPropertyMemberInviteNewEmail(invite.email, {
          acceptUrl,
          inviterName: summary.inviterName,
          propertyName: summary.propertyName,
          roleLabel: summary.roleLabel,
        });
    return { emailSent };
  } catch (error) {
    const emailError = error instanceof Error ? error.message : "Failed to send invite email";
    return { emailError, emailSent: false };
  }
}

async function createAndSendInvite(input: {
  email: string;
  invitedBy: string;
  property: IProperty;
  propertyId: string;
  role: TPropertyRole;
}): Promise<ICreatePropertyMemberInviteResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUser = await userDb.findByEmail(normalizedEmail);
  const status = await resolveInitialStatus(normalizedEmail);
  const rawToken = generatePropertyMemberInviteToken();
  const inviteTokenHash = hashPropertyMemberInviteToken(rawToken);

  const invite = await propertyInvitesDb.create({
    email: normalizedEmail,
    invitedBy: input.invitedBy,
    inviteTokenHash,
    propertyId: input.propertyId,
    role: input.role,
    status,
  });

  const inviter = await userDb.findById(input.invitedBy);
  if (!inviter) {
    throw new PropertyMemberInviteNotFoundError("Inviter not found");
  }

  const emailResult = await sendPropertyMemberInviteEmail(
    invite,
    input.property,
    inviter,
    rawToken,
    existingUser != null
  );

  if (!emailResult.emailSent) {
    const failed = await propertyInvitesDb.updateStatus(
      invite.id,
      PropertyInviteStatus.EMAIL_FAILED,
      emailResult.emailError
    );
    const resultInvite = failed ?? {
      ...invite,
      emailError: emailResult.emailError ?? null,
      status: PropertyInviteStatus.EMAIL_FAILED,
    };
    logPropertyMemberInviteInvited(resultInvite, { emailSent: false });
    return {
      emailError: emailResult.emailError,
      emailSent: false,
      invite: resultInvite,
    };
  }

  logPropertyMemberInviteInvited(invite, { emailSent: true });

  return {
    emailSent: true,
    invite,
  };
}

export const propertyMemberInviteService = {
  async createInvite(input: {
    email: string;
    invitedBy: string;
    propertyId: string;
    role: TPropertyRole;
  }): Promise<ICreatePropertyMemberInviteResult> {
    const property = await propertiesDb.findById(input.propertyId);
    if (!property) {
      throw new PropertyMemberInviteNotFoundError("Property not found");
    }

    return createAndSendInvite({
      email: input.email,
      invitedBy: input.invitedBy,
      property,
      propertyId: input.propertyId,
      role: input.role,
    });
  },

  async previewInvite(token: string): Promise<IPropertyInvitePreviewResponse> {
    const invite = await propertyInvitesDb.findByInviteToken(token);
    if (!invite) {
      throw new PropertyMemberInviteNotFoundError("Invalid or expired invite link");
    }

    if (!PENDING_PREVIEW_STATUSES.has(invite.status)) {
      throw new PropertyMemberInviteInvalidStateError("This invite is no longer available");
    }

    const expired = await propertyInvitesDb.expireInviteIfPastTtl(invite);
    if (expired) {
      throw new PropertyMemberInviteInvalidStateError("This invite has expired");
    }

    const property = await propertiesDb.findById(invite.propertyId);
    if (!property) {
      throw new PropertyMemberInviteNotFoundError("Property not found");
    }

    const inviter = await userDb.findById(invite.invitedBy);
    if (!inviter) {
      throw new PropertyMemberInviteNotFoundError("Property not found");
    }

    const hasExistingAccount = (await userDb.findByEmail(invite.email)) != null;

    return {
      hasExistingAccount,
      inviteEmail: invite.email,
      inviteId: invite.id,
      status: invite.status,
      summary: buildPropertyMemberInviteSummary(invite, property, inviter),
    };
  },

  async resendInvite(input: {
    inviteId: string;
    propertyId: string;
  }): Promise<ICreatePropertyMemberInviteResult> {
    const invite = await propertyInvitesDb.findById(input.inviteId);
    if (!invite || invite.propertyId !== input.propertyId) {
      throw new PropertyMemberInviteMismatchError();
    }

    if (
      !isPendingPropertyMemberInviteStatus(invite.status) &&
      invite.status !== PropertyInviteStatus.EMAIL_FAILED
    ) {
      throw new PropertyMemberInviteInvalidStateError(
        "Only pending property member invites can be resent"
      );
    }

    const property = await propertiesDb.findById(input.propertyId);
    if (!property) {
      throw new PropertyMemberInviteNotFoundError("Property not found");
    }

    const rawToken = generatePropertyMemberInviteToken();
    const updated = await propertyInvitesDb.updateInviteToken(
      invite.id,
      hashPropertyMemberInviteToken(rawToken)
    );
    if (!updated) {
      throw new PropertyMemberInviteNotFoundError("Property member invite not found");
    }

    const inviter = await userDb.findById(updated.invitedBy);
    if (!inviter) {
      throw new PropertyMemberInviteNotFoundError("Inviter not found");
    }

    const hasExistingAccount =
      updated.status === PropertyInviteStatus.PENDING_ACCEPTANCE ||
      (await userDb.findByEmail(updated.email)) != null;
    const emailResult = await sendPropertyMemberInviteEmail(
      updated,
      property,
      inviter,
      rawToken,
      hasExistingAccount
    );

    if (!emailResult.emailSent) {
      const failed = await propertyInvitesDb.updateStatus(
        updated.id,
        PropertyInviteStatus.EMAIL_FAILED,
        emailResult.emailError
      );
      const resultInvite = failed ?? {
        ...updated,
        emailError: emailResult.emailError ?? null,
        status: PropertyInviteStatus.EMAIL_FAILED,
      };
      logPropertyMemberInviteResent(resultInvite, { emailSent: false });
      return {
        emailError: emailResult.emailError,
        emailSent: false,
        invite: resultInvite,
      };
    }

    if (updated.status === PropertyInviteStatus.EMAIL_FAILED) {
      const restoredStatus = hasExistingAccount
        ? PropertyInviteStatus.PENDING_ACCEPTANCE
        : PropertyInviteStatus.PENDING_INVITE;
      const restored = await propertyInvitesDb.updateStatus(updated.id, restoredStatus);
      const resultInvite = restored ?? { ...updated, emailError: null, status: restoredStatus };
      logPropertyMemberInviteResent(resultInvite, { emailSent: true });
      return {
        emailSent: true,
        invite: resultInvite,
      };
    }

    logPropertyMemberInviteResent(updated, { emailSent: true });

    return {
      emailSent: true,
      invite: updated,
    };
  },

  async revokeInvite(input: {
    inviteId: string;
    propertyId: string;
  }): Promise<{ invite: IPropertyInvite }> {
    const invite = await propertyInvitesDb.findById(input.inviteId);
    if (!invite || invite.propertyId !== input.propertyId) {
      throw new PropertyMemberInviteMismatchError();
    }

    if (
      !isPendingPropertyMemberInviteStatus(invite.status) &&
      invite.status !== PropertyInviteStatus.EMAIL_FAILED
    ) {
      throw new PropertyMemberInviteInvalidStateError(
        "Only pending property member invites can be revoked"
      );
    }

    const updated = await propertyInvitesDb.transitionStatus(
      invite.id,
      PropertyInviteStatus.REVOKED
    );
    if (!updated) {
      throw new PropertyMemberInviteNotFoundError("Property member invite not found");
    }

    logPropertyMemberInviteRevoked(updated);
    return { invite: updated };
  },
};

export { DuplicatePropertyMemberInviteError };
