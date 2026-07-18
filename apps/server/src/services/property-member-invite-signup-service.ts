import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { verifyGoogleToken } from "@/auth/google";
import { isIdentityConflictError } from "@/constants/account";
import { propertyInvitesDb } from "@/db/property-invites";
import { userDb } from "@/db/users";
import {
  isPropertyMemberInviteDomainError,
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

export class PropertyMemberInviteSignupAccountExistsError extends Error {
  constructor(message = "Account already exists. Sign in to accept.") {
    super(message);
    this.name = "PropertyMemberInviteSignupAccountExistsError";
  }
}

export class PropertyMemberInviteSignupEmailMismatchError extends Error {
  constructor(
    message = "Google account email must match the invited email address for this property"
  ) {
    super(message);
    this.name = "PropertyMemberInviteSignupEmailMismatchError";
  }
}

export class PropertyMemberInviteSignupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyMemberInviteSignupValidationError";
  }
}

export type TPropertyMemberInviteSignupSuccess = {
  response: IPropertyInviteRedeemResponse;
  status: "ok";
};

export type TPropertyMemberInviteSignupFailure = {
  body: { code?: string; error: string };
  status: "error";
  statusCode: number;
};

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
    throw new PropertyMemberInviteSignupValidationError("token is required");
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
    throw new PropertyMemberInviteSignupAccountExistsError();
  }

  const existing = await userDb.findByEmail(invite.email);
  if (existing) {
    throw new PropertyMemberInviteSignupAccountExistsError();
  }
}

function mapSignupDomainError(error: unknown): TPropertyMemberInviteSignupFailure | null {
  if (error instanceof PropertyMemberInviteSignupValidationError) {
    return {
      body: { error: error.message },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }
  if (error instanceof PropertyMemberInviteSignupAccountExistsError) {
    return {
      body: { error: error.message },
      status: "error",
      statusCode: HttpStatus.CONFLICT,
    };
  }
  if (error instanceof PropertyMemberInviteSignupEmailMismatchError) {
    return {
      body: { error: error.message },
      status: "error",
      statusCode: HttpStatus.FORBIDDEN,
    };
  }
  if (isPropertyMemberInviteDomainError(error)) {
    return {
      body: { code: error.code, error: error.message },
      status: "error",
      statusCode: error.httpStatus,
    };
  }
  if (isIdentityConflictError(error)) {
    return {
      body: { code: error.code, error: error.message },
      status: "error",
      statusCode: HttpStatus.CONFLICT,
    };
  }
  return null;
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
      throw new PropertyMemberInviteSignupValidationError(nameErr);
    }
    const passwordErr = validatePassword(input.body.password);
    if (passwordErr) {
      throw new PropertyMemberInviteSignupValidationError(passwordErr);
    }

    const name = normalizePersonName(input.body.name).trim();
    if (!name) {
      throw new PropertyMemberInviteSignupValidationError("Name is required");
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
    const mapped = mapSignupDomainError(error);
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
      throw new PropertyMemberInviteSignupValidationError("idToken is required");
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
      throw new PropertyMemberInviteSignupEmailMismatchError();
    }

    const { user } = await userDb.findOrCreateByGoogle({
      email: invite.email,
      googleId: googleUser.googleId,
      name: googleUser.name?.trim() || "User",
    });

    const response = await completeSignup(server, input.body.token.trim(), user);
    return { response, status: "ok" };
  } catch (error) {
    const mapped = mapSignupDomainError(error);
    if (mapped) {
      return mapped;
    }
    throw error;
  }
}
