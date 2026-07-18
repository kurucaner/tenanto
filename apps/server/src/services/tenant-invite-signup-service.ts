import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { verifyGoogleToken } from "@/auth/google";
import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  inviteSignupAccountExistsError,
  inviteSignupEmailMismatchError,
  inviteSignupValidationError,
} from "@/errors/invite-signup-errors";
import {
  portalInviteInvalidStateError,
  portalInviteNotFoundError,
} from "@/errors/portal-invite-errors";
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
  requireMembershipInviteEmail,
  TenantMembershipStatus,
  type TPlatform,
  type TTenantMembershipStatus,
} from "@/packages/shared";
import { validateName, validatePassword } from "@/routes/auth/validators";
import {
  mapInviteSignupDomainError,
  type TInviteSignupFailure,
} from "@/services/map-invite-signup-domain-error";
import {
  assertTenantAuthEmailAttemptAllowed,
  assertTenantAuthIpAttemptAllowed,
  getTenantAuthRateLimitErrorMessage,
} from "@/services/tenant-auth-rate-limit";
import { issueTenantSession } from "@/services/tenant-auth-service";
import { tenantPortalMembershipService } from "@/services/tenant-portal-membership-service";

export type TTenantInviteSignupSuccess = {
  response: ITenantInviteRedeemResponse;
  status: "ok";
};

export type TTenantInviteSignupFailure = TInviteSignupFailure;

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
    throw inviteSignupValidationError("token is required");
  }

  const membership = await leaseTenantMembershipsDb.findByInviteToken(trimmed);
  if (!membership) {
    throw portalInviteNotFoundError("Invalid or expired invite link");
  }

  if (
    membership.status === TenantMembershipStatus.DECLINED ||
    membership.status === TenantMembershipStatus.EXPIRED
  ) {
    throw portalInviteInvalidStateError(
      "This invite is no longer available. Ask your property manager to resend."
    );
  }

  if (!ACCEPTABLE_STATUSES.has(membership.status)) {
    throw portalInviteInvalidStateError("This invite is no longer available");
  }

  const expired = await leaseTenantMembershipsDb.expireMembershipIfPastTtl(membership);
  if (expired) {
    throw portalInviteInvalidStateError("This invite has expired");
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
    const inviteEmail = requireMembershipInviteEmail(membership.inviteEmail);

    const rateLimited = await enforceSignupRateLimits({
      action: "register_start",
      email: inviteEmail,
      ip: input.ip,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const existing = await tenantUsersDb.findByEmail(inviteEmail);
    if (existing) {
      throw inviteSignupAccountExistsError();
    }

    const nameErr = validateName(input.body.name);
    if (nameErr) {
      throw inviteSignupValidationError(nameErr);
    }
    const passwordErr = validatePassword(input.body.password);
    if (passwordErr) {
      throw inviteSignupValidationError(passwordErr);
    }

    const name =
      normalizePersonName(input.body.name).trim() ||
      normalizePersonName(membership.displayName).trim();
    if (!name) {
      throw inviteSignupValidationError("Name is required");
    }

    const passwordHash = await bcrypt.hash(input.body.password, 10);
    const user = await tenantUsersDb.create({
      email: inviteEmail,
      emailVerifiedAt: new Date(),
      name,
      passwordHash,
    });

    const response = await completeSignup(server, input.body.token.trim(), user);
    return { response, status: "ok" };
  } catch (error) {
    const mapped = mapInviteSignupDomainError(error);
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
      throw inviteSignupValidationError("idToken is required");
    }

    const membership = await loadRedeemableInviteMembership(input.body.token);
    const inviteEmail = requireMembershipInviteEmail(membership.inviteEmail);

    const rateLimited = await enforceSignupRateLimits({
      action: "google",
      email: inviteEmail,
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

    if (normalizeTenantEmail(googleUser.email) !== inviteEmail) {
      throw inviteSignupEmailMismatchError(
        "Google account email must match the invited email address for this lease"
      );
    }

    const { user } = await tenantUsersDb.findOrCreateByGoogle({
      email: inviteEmail,
      googleId: googleUser.googleId,
      name: googleUser.name?.trim() || membership.displayName,
    });

    const response = await completeSignup(server, input.body.token.trim(), user);
    return { response, status: "ok" };
  } catch (error) {
    const mapped = mapInviteSignupDomainError(error);
    if (mapped) {
      return mapped;
    }
    throw error;
  }
}
