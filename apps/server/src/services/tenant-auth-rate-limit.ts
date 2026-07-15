import { formatRateLimitRetryAfter, formatRateLimitWindow } from "@/lib/rate-limit-messages";
import { consumeFixedWindowRateLimit } from "@/lib/redis-fixed-window-rate-limit";
import {
  TENANT_AUTH_EMAIL_RATE_LIMIT_MAX,
  TENANT_AUTH_IP_RATE_LIMIT_MAX,
  TENANT_AUTH_RATE_LIMIT_WINDOW_MS,
} from "@/lib/tenant-portal-rate-limit-config";

export type TTenantAuthRateLimitAction = "apple" | "google" | "login" | "register_start";

function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

async function consumeTenantAuthIpLimit(input: {
  action: TTenantAuthRateLimitAction;
  ip: string;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  return consumeFixedWindowRateLimit({
    key: `tenant-auth:${input.action}:ip:${input.ip}`,
    limit: TENANT_AUTH_IP_RATE_LIMIT_MAX,
    windowMs: TENANT_AUTH_RATE_LIMIT_WINDOW_MS,
  });
}

async function consumeTenantAuthEmailLimit(input: {
  action: TTenantAuthRateLimitAction;
  email: string;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const emailKey = normalizeEmailKey(input.email);
  if (!emailKey) {
    return { allowed: true };
  }

  return consumeFixedWindowRateLimit({
    key: `tenant-auth:${input.action}:email:${emailKey}`,
    limit: TENANT_AUTH_EMAIL_RATE_LIMIT_MAX,
    windowMs: TENANT_AUTH_RATE_LIMIT_WINDOW_MS,
  });
}

/** IP + optional email window (used by email/password login and register). */
export async function assertTenantAuthAttemptAllowed(input: {
  action: TTenantAuthRateLimitAction;
  email: string;
  ip: string;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const ipResult = await consumeTenantAuthIpLimit(input);
  if (!ipResult.allowed) {
    return ipResult;
  }

  return consumeTenantAuthEmailLimit({
    action: input.action,
    email: input.email,
  });
}

/** Email-only window after a social token is verified (avoids double-counting IP). */
export async function assertTenantAuthEmailAttemptAllowed(input: {
  action: TTenantAuthRateLimitAction;
  email: string;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  return consumeTenantAuthEmailLimit(input);
}

/** IP-only window before verifying a social ID token. */
export async function assertTenantAuthIpAttemptAllowed(input: {
  action: TTenantAuthRateLimitAction;
  ip: string;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  return consumeTenantAuthIpLimit(input);
}

export function getTenantAuthRateLimitErrorMessage(input: {
  retryAfterSec: number;
  windowMs: number;
}): string {
  const windowLabel = formatRateLimitWindow(input.windowMs);
  const retryLabel = formatRateLimitRetryAfter(input.retryAfterSec);
  return `Too many authentication attempts. Limit applies every ${windowLabel}. Try again in ${retryLabel}.`;
}
