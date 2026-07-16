import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { verifyGoogleToken } from "@/auth/google";
import { isIdentityConflictError } from "@/constants/account";
import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";
import { tenantUsersDb } from "@/db/tenant-users";
import { TENANT_AUTH_RATE_LIMIT_WINDOW_MS } from "@/lib/tenant-portal-rate-limit-config";
import {
  HttpStatus,
  type ILeaseTenantMembership,
  type ITenantInviteRedeemResponse,
  type ITenantInviteRegisterBody,
  type ITenantInviteRegisterGoogleBody,
  type ITenantUser,
  normalizePersonName,
  normalizeTenantEmail,
  TenantMembershipStatus,
  type TPlatform,
  type TTenantMembershipStatus,
} from "@/packages/shared";
import { validateName, validatePassword } from "@/routes/auth/validators";
import {
  assertTenantAuthEmailAttemptAllowed,
  assertTenantAuthIpAttemptAllowed,
  getTenantAuthRateLimitErrorMessage,
} from "@/services/tenant-auth-rate-limit";
import { issueTenantSession } from "@/services/tenant-auth-service";
import {
  PortalInviteInvalidStateError,
  PortalInviteNotFoundError,
} from "@/services/tenant-portal-invite-service";
import { tenantPortalMembershipService } from "@/services/tenant-portal-membership-service";

export class TenantInviteSignupAccountExistsError extends Error {
  constructor(message = "Account already exists. Sign in to accept.") {
    super(message);
    this.name = "TenantInviteSignupAccountExistsError";
  }
}

export class TenantInviteSignupEmailMismatchError extends Error {
  constructor(
    message = "Google account email must match the invited email address for this lease"
  ) {
    super(message);
    this.name = "TenantInviteSignupEmailMismatchError";
  }
}

export class TenantInviteSignupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantInviteSignupValidationError";
  }
}

export type TTenantInviteSignupSuccess = {
  response: ITenantInviteRedeemResponse;
  status: "ok";
};

export type TTenantInviteSignupFailure = {
  body: { code?: string; error: string };
  headers?: Record<string, string>;
  status: "error";
  statusCode: number;
};

export type TTenantInviteSignupResult = TTenantInviteSignupFailure | TTenantInviteSignupSuccess;

const ACCEPTABLE_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_INVITE,
  TenantMembershipStatus.PENDING_ACCEPTANCE,
]);

function rateLimitedResult(retryAfterSec: number): TTenantInviteSignupFailure {
  return {
    body: {
      error: getTenantAuthRateLimitErrorMessage({
        retryAfterSec,
        windowMs: TENANT_AUTH_RATE_LIMIT_WINDOW_MS,
      }),
    },
    headers: { "Retry-After": String(retryAfterSec) },
    status: "error",
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
  };
}

async function loadRedeemableInviteMembership(token: string): Promise<ILeaseTenantMembership> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new TenantInviteSignupValidationError("token is required");
  }

  const membership = await leaseTenantMembershipsDb.findByInviteToken(trimmed);
  if (!membership) {
    throw new PortalInviteNotFoundError("Invalid or expired invite link");
  }

  if (
    membership.status === TenantMembershipStatus.DECLINED ||
    membership.status === TenantMembershipStatus.EXPIRED
  ) {
    throw new PortalInviteInvalidStateError(
      "This invite is no longer available. Ask your property manager to resend."
    );
  }

  if (!ACCEPTABLE_STATUSES.has(membership.status)) {
    throw new PortalInviteInvalidStateError("This invite is no longer available");
  }

  const expired = await leaseTenantMembershipsDb.expireMembershipIfPastTtl(membership);
  if (expired) {
    throw new PortalInviteInvalidStateError("This invite has expired");
  }

  return membership;
}

async function enforceSignupRateLimits(input: {
  action: "google" | "register_start";
  email: string;
  ip: string;
}): Promise<TTenantInviteSignupFailure | null> {
  const ipLimit = await assertTenantAuthIpAttemptAllowed({
    action: input.action,
    ip: input.ip,
  });
  if (!ipLimit.allowed) {
    return rateLimitedResult(ipLimit.retryAfterSec);
  }

  const emailLimit = await assertTenantAuthEmailAttemptAllowed({
    action: input.action,
    email: input.email,
  });
  if (!emailLimit.allowed) {
    return rateLimitedResult(emailLimit.retryAfterSec);
  }

  return null;
}

function mapSignupDomainError(error: unknown): TTenantInviteSignupFailure | null {
  if (error instanceof TenantInviteSignupValidationError) {
    return {
      body: { error: error.message },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }
  if (error instanceof TenantInviteSignupAccountExistsError) {
    return {
      body: { error: error.message },
      status: "error",
      statusCode: HttpStatus.CONFLICT,
    };
  }
  if (error instanceof TenantInviteSignupEmailMismatchError) {
    return {
      body: { error: error.message },
      status: "error",
      statusCode: HttpStatus.FORBIDDEN,
    };
  }
  if (error instanceof PortalInviteNotFoundError) {
    return {
      body: { error: error.message },
      status: "error",
      statusCode: HttpStatus.NOT_FOUND,
    };
  }
  if (error instanceof PortalInviteInvalidStateError) {
    return {
      body: { error: error.message },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
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
  user: ITenantUser
): Promise<ITenantInviteRedeemResponse> {
  const membership = await tenantPortalMembershipService.redeemInvite(token, user);
  const session = await issueTenantSession(server, user);
  return { membership, session };
}

export async function registerTenantWithInvitePassword(
  server: FastifyInstance,
  input: {
    body: ITenantInviteRegisterBody;
    ip: string;
  }
): Promise<TTenantInviteSignupResult> {
  try {
    const membership = await loadRedeemableInviteMembership(input.body.token);

    const rateLimited = await enforceSignupRateLimits({
      action: "register_start",
      email: membership.inviteEmail,
      ip: input.ip,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const existing = await tenantUsersDb.findByEmail(membership.inviteEmail);
    if (existing) {
      throw new TenantInviteSignupAccountExistsError();
    }

    const nameErr = validateName(input.body.name);
    if (nameErr) {
      throw new TenantInviteSignupValidationError(nameErr);
    }
    const passwordErr = validatePassword(input.body.password);
    if (passwordErr) {
      throw new TenantInviteSignupValidationError(passwordErr);
    }

    const name =
      normalizePersonName(input.body.name).trim() ||
      normalizePersonName(membership.displayName).trim();
    if (!name) {
      throw new TenantInviteSignupValidationError("Name is required");
    }

    const passwordHash = await bcrypt.hash(input.body.password, 10);
    const user = await tenantUsersDb.create({
      email: membership.inviteEmail,
      emailVerifiedAt: new Date(),
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

export async function registerTenantWithInviteGoogle(
  server: FastifyInstance,
  input: {
    body: ITenantInviteRegisterGoogleBody;
    ip: string;
    platform: TPlatform;
  }
): Promise<TTenantInviteSignupResult> {
  try {
    const idToken = input.body.idToken?.trim();
    if (!idToken) {
      throw new TenantInviteSignupValidationError("idToken is required");
    }

    const membership = await loadRedeemableInviteMembership(input.body.token);

    const rateLimited = await enforceSignupRateLimits({
      action: "google",
      email: membership.inviteEmail,
      ip: input.ip,
    });
    if (rateLimited) {
      return rateLimited;
    }

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

    if (normalizeTenantEmail(googleUser.email) !== normalizeTenantEmail(membership.inviteEmail)) {
      throw new TenantInviteSignupEmailMismatchError();
    }

    const { user } = await tenantUsersDb.findOrCreateByGoogle({
      email: membership.inviteEmail,
      googleId: googleUser.googleId,
      name: googleUser.name?.trim() || membership.displayName,
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
