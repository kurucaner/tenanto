import type { FastifyInstance } from "fastify";

import { verifyAppleToken } from "@/auth/apple";
import { verifyGoogleToken } from "@/auth/google";
import { isIdentityConflictError } from "@/constants/account";
import { tenantUsersDb } from "@/db/tenant-users";
import { TENANT_AUTH_RATE_LIMIT_WINDOW_MS } from "@/lib/tenant-portal-rate-limit-config";
import {
  HttpStatus,
  type ITenantAppleAuthBody,
  type ITenantAuthSessionResponse,
  type ITenantGoogleAuthBody,
  type TPlatform,
} from "@/packages/shared";
import {
  assertTenantAuthEmailAttemptAllowed,
  assertTenantAuthIpAttemptAllowed,
  getTenantAuthRateLimitErrorMessage,
  type TTenantAuthRateLimitAction,
} from "@/services/tenant-auth-rate-limit";
import { issueTenantSession } from "@/services/tenant-auth-service";

export type TTenantSocialAuthSuccess = {
  session: ITenantAuthSessionResponse;
  status: "ok";
};

export type TTenantSocialAuthFailure = {
  body: { code?: string; error: string };
  headers?: Record<string, string>;
  status: "error";
  statusCode: number;
};

export type TTenantSocialAuthResult = TTenantSocialAuthFailure | TTenantSocialAuthSuccess;

function rateLimitedResult(retryAfterSec: number): TTenantSocialAuthFailure {
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

async function enforceSocialIpLimit(
  action: TTenantAuthRateLimitAction,
  ip: string
): Promise<TTenantSocialAuthFailure | null> {
  const ipLimit = await assertTenantAuthIpAttemptAllowed({ action, ip });
  if (!ipLimit.allowed) {
    return rateLimitedResult(ipLimit.retryAfterSec);
  }
  return null;
}

async function enforceSocialEmailLimit(
  action: TTenantAuthRateLimitAction,
  email: string
): Promise<TTenantSocialAuthFailure | null> {
  const emailLimit = await assertTenantAuthEmailAttemptAllowed({ action, email });
  if (!emailLimit.allowed) {
    return rateLimitedResult(emailLimit.retryAfterSec);
  }
  return null;
}

function mapFindOrCreateError(error: unknown): TTenantSocialAuthFailure {
  if (isIdentityConflictError(error)) {
    return {
      body: { code: error.code, error: error.message },
      status: "error",
      statusCode: HttpStatus.CONFLICT,
    };
  }
  throw error;
}

export async function authenticateTenantWithGoogle(
  server: FastifyInstance,
  input: {
    body: ITenantGoogleAuthBody;
    ip: string;
    platform: TPlatform;
  }
): Promise<TTenantSocialAuthResult> {
  const idToken = input.body.idToken?.trim();
  if (!idToken) {
    return {
      body: { error: "idToken is required" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }

  const ipBlocked = await enforceSocialIpLimit("google", input.ip);
  if (ipBlocked) {
    return ipBlocked;
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

  const emailBlocked = await enforceSocialEmailLimit("google", googleUser.email);
  if (emailBlocked) {
    return emailBlocked;
  }

  let user;
  try {
    const result = await tenantUsersDb.findOrCreateByGoogle({
      email: googleUser.email,
      googleId: googleUser.googleId,
      name: googleUser.name,
    });
    user = result.user;
  } catch (error) {
    return mapFindOrCreateError(error);
  }

  return {
    session: await issueTenantSession(server, user),
    status: "ok",
  };
}

export async function authenticateTenantWithApple(
  server: FastifyInstance,
  input: {
    body: ITenantAppleAuthBody;
    ip: string;
  }
): Promise<TTenantSocialAuthResult> {
  const identityToken = input.body.identityToken?.trim();
  if (!identityToken) {
    return {
      body: { error: "identityToken is required" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }

  const ipBlocked = await enforceSocialIpLimit("apple", input.ip);
  if (ipBlocked) {
    return ipBlocked;
  }

  let appleUser;
  try {
    appleUser = await verifyAppleToken(identityToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apple sign-in failed";
    return {
      body: { error: message },
      status: "error",
      statusCode: HttpStatus.UNAUTHORIZED,
    };
  }

  if (appleUser.email) {
    const emailBlocked = await enforceSocialEmailLimit("apple", appleUser.email);
    if (emailBlocked) {
      return emailBlocked;
    }
  }

  const bodyName = input.body.name?.trim();
  const name = bodyName && bodyName.length > 0 ? bodyName : appleUser.name;

  let user;
  try {
    const result = await tenantUsersDb.findOrCreateByApple({
      appleId: appleUser.appleId,
      email: appleUser.email,
      name,
    });
    user = result.user;
  } catch (error) {
    if (error instanceof Error && error.message === "Email required for first-time Apple sign-in") {
      return {
        body: { error: error.message },
        status: "error",
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }
    return mapFindOrCreateError(error);
  }

  return {
    session: await issueTenantSession(server, user),
    status: "ok",
  };
}
