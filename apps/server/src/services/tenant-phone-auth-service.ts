import type { FastifyInstance } from "fastify";

import { isIdentityConflictError } from "@/constants/account";
import { tenantUsersDb } from "@/db/tenant-users";
import { isAuthOtpRateLimitError } from "@/errors/auth-otp-errors";
import { isTenantPhoneAuthEnabled } from "@/lib/tenant-auth-expansion-config";
import { TENANT_AUTH_RATE_LIMIT_WINDOW_MS } from "@/lib/tenant-portal-rate-limit-config";
import {
  AccountError,
  HttpStatus,
  type ITenantAuthSessionResponse,
  type ITenantPhoneAuthStartBody,
  type ITenantPhoneAuthVerifyBody,
  type ITenantPhoneBindStartBody,
  type ITenantPhoneBindVerifyBody,
  type ITenantUser,
} from "@/packages/shared";
import {
  deletePhoneOtpById,
  sendPhoneOtpWithCooldown,
  verifyPhoneOtpCode,
} from "@/services/auth-phone-otp-service";
import {
  assertTenantAuthPhoneAttemptAllowed,
  getTenantAuthRateLimitErrorMessage,
} from "@/services/tenant-auth-rate-limit";
import { issueTenantSession } from "@/services/tenant-auth-service";
import { resolveSmsPhoneNumber } from "@/sns/sns";

export type TTenantPhoneAuthSuccess =
  | { session: ITenantAuthSessionResponse; status: "ok"; user?: undefined }
  | { session?: undefined; status: "ok"; user: ITenantUser }
  | { session?: undefined; status: "ok"; user?: undefined };

export type TTenantPhoneAuthFailure = {
  body: { code?: string; error: string };
  headers?: Record<string, string>;
  status: "error";
  statusCode: number;
};

export type TTenantPhoneAuthResult = TTenantPhoneAuthFailure | TTenantPhoneAuthSuccess;

function disabledResult(): TTenantPhoneAuthFailure {
  return {
    body: { error: "Not found" },
    status: "error",
    statusCode: HttpStatus.NOT_FOUND,
  };
}

function rateLimitedResult(retryAfterSec: number): TTenantPhoneAuthFailure {
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

function invalidPhoneResult(error: unknown): TTenantPhoneAuthFailure | null {
  if (!(error instanceof Error)) return null;
  if (!error.message.includes("must be a valid E.164")) return null;
  return {
    body: { error: "phone must be a valid phone number" },
    status: "error",
    statusCode: HttpStatus.BAD_REQUEST,
  };
}

function mapOtpSendError(error: unknown): TTenantPhoneAuthFailure | null {
  if (isAuthOtpRateLimitError(error)) {
    return {
      body: { code: error.code, error: error.message },
      status: "error",
      statusCode: error.httpStatus,
    };
  }
  return invalidPhoneResult(error);
}

const GENERIC_LOGIN_START_OK: TTenantPhoneAuthSuccess = { status: "ok" };

/**
 * Login OTP start. Anti-enumeration: unknown / unverified numbers get the same
 * success response without sending SMS.
 */
export async function startTenantPhoneLogin(input: {
  body: ITenantPhoneAuthStartBody;
  ip: string;
}): Promise<TTenantPhoneAuthResult> {
  if (!isTenantPhoneAuthEnabled()) {
    return disabledResult();
  }

  const rawPhone = input.body.phone?.trim() ?? "";
  if (!rawPhone) {
    return {
      body: { error: "phone is required" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }

  let e164: string;
  try {
    e164 = resolveSmsPhoneNumber(rawPhone, "phone");
  } catch (error) {
    return (
      invalidPhoneResult(error) ?? {
        body: { error: "phone must be a valid phone number" },
        status: "error",
        statusCode: HttpStatus.BAD_REQUEST,
      }
    );
  }

  const rateLimit = await assertTenantAuthPhoneAttemptAllowed({
    action: "phone_login",
    ip: input.ip,
    phone: e164,
  });
  if (!rateLimit.allowed) {
    return rateLimitedResult(rateLimit.retryAfterSec);
  }

  const existing = await tenantUsersDb.findByVerifiedPhone(e164);
  if (!existing) {
    return GENERIC_LOGIN_START_OK;
  }

  try {
    await sendPhoneOtpWithCooldown({
      phone: e164,
      purpose: "tenant_phone_login",
    });
  } catch (error) {
    const mapped = mapOtpSendError(error);
    if (mapped) return mapped;
    throw error;
  }

  return GENERIC_LOGIN_START_OK;
}

export async function verifyTenantPhoneLogin(
  server: FastifyInstance,
  input: {
    body: ITenantPhoneAuthVerifyBody;
    ip: string;
  }
): Promise<TTenantPhoneAuthResult> {
  if (!isTenantPhoneAuthEnabled()) {
    return disabledResult();
  }

  const rawPhone = input.body.phone?.trim() ?? "";
  const code = input.body.code?.trim() ?? "";
  if (!rawPhone || !code) {
    return {
      body: { error: "phone and code are required" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }

  let e164: string;
  try {
    e164 = resolveSmsPhoneNumber(rawPhone, "phone");
  } catch (error) {
    return (
      invalidPhoneResult(error) ?? {
        body: { error: "phone must be a valid phone number" },
        status: "error",
        statusCode: HttpStatus.BAD_REQUEST,
      }
    );
  }

  const rateLimit = await assertTenantAuthPhoneAttemptAllowed({
    action: "phone_login",
    ip: input.ip,
    phone: e164,
  });
  if (!rateLimit.allowed) {
    return rateLimitedResult(rateLimit.retryAfterSec);
  }

  const verified = await verifyPhoneOtpCode({
    otp: code,
    phone: e164,
    purpose: "tenant_phone_login",
  });
  if (!verified.ok) {
    return {
      body: { error: "Invalid or expired verification code" },
      status: "error",
      statusCode: HttpStatus.UNAUTHORIZED,
    };
  }

  await deletePhoneOtpById(verified.otpRowId);

  const user = await tenantUsersDb.findByVerifiedPhone(e164);
  if (!user) {
    return {
      body: { error: "Invalid or expired verification code" },
      status: "error",
      statusCode: HttpStatus.UNAUTHORIZED,
    };
  }

  return {
    session: await issueTenantSession(server, user),
    status: "ok",
  };
}

export async function startTenantPhoneBind(input: {
  body: ITenantPhoneBindStartBody;
  ip: string;
  tenantUserId: string;
}): Promise<TTenantPhoneAuthResult> {
  if (!isTenantPhoneAuthEnabled()) {
    return disabledResult();
  }

  const rawPhone = input.body.phone?.trim() ?? "";
  if (!rawPhone) {
    return {
      body: { error: "phone is required" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }

  let e164: string;
  try {
    e164 = resolveSmsPhoneNumber(rawPhone, "phone");
  } catch (error) {
    return (
      invalidPhoneResult(error) ?? {
        body: { error: "phone must be a valid phone number" },
        status: "error",
        statusCode: HttpStatus.BAD_REQUEST,
      }
    );
  }

  const rateLimit = await assertTenantAuthPhoneAttemptAllowed({
    action: "phone_bind",
    ip: input.ip,
    phone: e164,
  });
  if (!rateLimit.allowed) {
    return rateLimitedResult(rateLimit.retryAfterSec);
  }

  const existing = await tenantUsersDb.findByPhone(e164);
  if (existing && existing.id !== input.tenantUserId) {
    return {
      body: {
        code: AccountError.IDENTITY_CONFLICT,
        error: "This phone number is already linked to another account",
      },
      status: "error",
      statusCode: HttpStatus.CONFLICT,
    };
  }

  try {
    await sendPhoneOtpWithCooldown({
      phone: e164,
      purpose: "tenant_phone_bind",
    });
  } catch (error) {
    const mapped = mapOtpSendError(error);
    if (mapped) return mapped;
    throw error;
  }

  return { status: "ok" };
}

export async function verifyTenantPhoneBind(input: {
  body: ITenantPhoneBindVerifyBody;
  ip: string;
  tenantUserId: string;
}): Promise<TTenantPhoneAuthResult> {
  if (!isTenantPhoneAuthEnabled()) {
    return disabledResult();
  }

  const rawPhone = input.body.phone?.trim() ?? "";
  const code = input.body.code?.trim() ?? "";
  if (!rawPhone || !code) {
    return {
      body: { error: "phone and code are required" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    };
  }

  let e164: string;
  try {
    e164 = resolveSmsPhoneNumber(rawPhone, "phone");
  } catch (error) {
    return (
      invalidPhoneResult(error) ?? {
        body: { error: "phone must be a valid phone number" },
        status: "error",
        statusCode: HttpStatus.BAD_REQUEST,
      }
    );
  }

  const rateLimit = await assertTenantAuthPhoneAttemptAllowed({
    action: "phone_bind",
    ip: input.ip,
    phone: e164,
  });
  if (!rateLimit.allowed) {
    return rateLimitedResult(rateLimit.retryAfterSec);
  }

  const verified = await verifyPhoneOtpCode({
    otp: code,
    phone: e164,
    purpose: "tenant_phone_bind",
  });
  if (!verified.ok) {
    return {
      body: { error: "Invalid or expired verification code" },
      status: "error",
      statusCode: HttpStatus.UNAUTHORIZED,
    };
  }

  await deletePhoneOtpById(verified.otpRowId);

  try {
    const user = await tenantUsersDb.setVerifiedPhone(input.tenantUserId, e164);
    return { status: "ok", user };
  } catch (error) {
    if (isIdentityConflictError(error)) {
      return {
        body: { code: error.code, error: error.message },
        status: "error",
        statusCode: HttpStatus.CONFLICT,
      };
    }
    throw error;
  }
}
