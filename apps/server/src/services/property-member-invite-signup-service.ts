import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { verifyGoogleToken } from "@/auth/google";
import { propertyInvitesDb } from "@/db/property-invites";
import { userDb } from "@/db/users";
import {
  inviteSignupAccountExistsError,
  inviteSignupEmailMismatchError,
  inviteSignupValidationError,
} from "@/errors/invite-signup-errors";
import {
  propertyMemberInviteInvalidStateError,
  propertyMemberInviteNotFoundError,
} from "@/errors/property-member-invite-errors";
import {
  HttpStatus,
  type IPropertyInvite,
  type IPropertyInviteRedeemResponse,
  type IPropertyInviteRegisterBody,
  type IPropertyInviteRegisterGoogleBody,
  type IUser,
  normalizePersonName,
  PropertyInviteStatus,
  type TPlatform,
} from "@/packages/shared";
import { validateName, validatePassword } from "@/routes/auth/validators";
import { issuePlatformSession } from "@/services/platform-auth-service";
import { propertyMemberInviteActionService } from "@/services/property-member-invite-action-service";
import {
  mapInviteSignupDomainError,
  type TInviteSignupFailure,
} from "@/services/map-invite-signup-domain-error";

export type TPropertyMemberInviteSignupSuccess = {
  response: IPropertyInviteRedeemResponse;
  status: "ok";
};

export type TPropertyMemberInviteSignupFailure = TInviteSignupFailure;

export type TPropertyMemberInviteSignupResult =
  TPropertyMemberInviteSignupFailure | TPropertyMemberInviteSignupSuccess;

const ACCEPTABLE_STATUSES = new Set<string>([
  PropertyInviteStatus.PENDING,
  PropertyInviteStatus.PENDING_INVITE,
  PropertyInviteStatus.PENDING_ACCEPTANCE,
]);

function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function loadRedeemableInviteForSignup(token: string): Promise<IPropertyInvite> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw inviteSignupValidationError("token is required");
  }

  const invite = await propertyInvitesDb.findByInviteToken(trimmed);
  if (!invite) {
    throw propertyMemberInviteNotFoundError("Invalid or expired invite link");
  }

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

  return invite;
}

async function assertNewInviteSignupAllowed(invite: IPropertyInvite): Promise<void> {
  if (invite.status !== PropertyInviteStatus.PENDING_INVITE) {
    throw inviteSignupAccountExistsError();
  }

  const existing = await userDb.findByEmail(invite.email);
  if (existing) {
    throw inviteSignupAccountExistsError();
  }
}

async function completeSignup(
  server: FastifyInstance,
  token: string,
  user: IUser
): Promise<IPropertyInviteRedeemResponse> {
  const result = await propertyMemberInviteActionService.redeemInvite(token, user);
  const session = await issuePlatformSession(server, user);
  return { ...result, session };
}

export async function registerPlatformUserWithInvitePassword(
  server: FastifyInstance,
  input: {
    body: IPropertyInviteRegisterBody;
    ip: string;
  }
): Promise<TPropertyMemberInviteSignupResult> {
  void input.ip;

  try {
    const invite = await loadRedeemableInviteForSignup(input.body.token);
    await assertNewInviteSignupAllowed(invite);

    const nameErr = validateName(input.body.name);
    if (nameErr) {
      throw inviteSignupValidationError(nameErr);
    }
    const passwordErr = validatePassword(input.body.password);
    if (passwordErr) {
      throw inviteSignupValidationError(passwordErr);
    }

    const name = normalizePersonName(input.body.name).trim();
    if (!name) {
      throw inviteSignupValidationError("Name is required");
    }

    const passwordHash = await bcrypt.hash(input.body.password, 10);
    const user = await userDb.createWithEmail({
      email: invite.email,
      name,
      passwordHash,
    });

    const response = await completeSignup(server, input.body.token.trim(), user);
    return { response, status: "ok" };
  } catch (error) {
    const mapped = mapInviteSignupDomainError(error, { includePropertyMemberInviteErrors: true });
    if (mapped) {
      return mapped;
    }
    throw error;
  }
}

export async function registerPlatformUserWithInviteGoogle(
  server: FastifyInstance,
  input: {
    body: IPropertyInviteRegisterGoogleBody;
    ip: string;
    platform: TPlatform;
  }
): Promise<TPropertyMemberInviteSignupResult> {
  void input.ip;

  try {
    const idToken = input.body.idToken?.trim();
    if (!idToken) {
      throw inviteSignupValidationError("idToken is required");
    }

    const invite = await loadRedeemableInviteForSignup(input.body.token);
    await assertNewInviteSignupAllowed(invite);

    let googleUser;
    try {
      googleUser = await verifyGoogleToken({ idToken, platform: input.platform });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed";
      return {
        body: { error: message },
        status: "error",
        statusCode: HttpStatus.UNAUTHORIZED,
      };
    }

    if (normalizeInviteEmail(googleUser.email) !== normalizeInviteEmail(invite.email)) {
      throw inviteSignupEmailMismatchError(
        "Google account email must match the invited email address for this property"
      );
    }

    const { user } = await userDb.findOrCreateByGoogle({
      email: invite.email,
      googleId: googleUser.googleId,
      name: googleUser.name?.trim() || "User",
    });

    const response = await completeSignup(server, input.body.token.trim(), user);
    return { response, status: "ok" };
  } catch (error) {
    const mapped = mapInviteSignupDomainError(error, { includePropertyMemberInviteErrors: true });
    if (mapped) {
      return mapped;
    }
    throw error;
  }
}
