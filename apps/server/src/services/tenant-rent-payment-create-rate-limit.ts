import type IORedis from "ioredis";

import { formatRateLimitRetryAfter, formatRateLimitWindow } from "@/lib/rate-limit-messages";
import { consumeFixedWindowRateLimit } from "@/lib/redis-fixed-window-rate-limit";

/** Max checkout/PI create requests per tenant per lease per window (default: 10 / 15 min). */
export const TENANT_RENT_PAYMENT_CREATE_LEASE_RATE_LIMIT_MAX = Number.parseInt(
  process.env.TENANT_RENT_PAYMENT_CREATE_LEASE_RATE_LIMIT_MAX ?? "10",
  10
);

export const TENANT_RENT_PAYMENT_CREATE_LEASE_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.TENANT_RENT_PAYMENT_CREATE_LEASE_RATE_LIMIT_WINDOW_MS ?? "900000",
  10
);

/** Max checkout/PI create requests per tenant IP per window (default: 20 / 15 min). */
export const TENANT_RENT_PAYMENT_CREATE_IP_RATE_LIMIT_MAX = Number.parseInt(
  process.env.TENANT_RENT_PAYMENT_CREATE_IP_RATE_LIMIT_MAX ?? "20",
  10
);

export const TENANT_RENT_PAYMENT_CREATE_IP_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.TENANT_RENT_PAYMENT_CREATE_IP_RATE_LIMIT_WINDOW_MS ?? "900000",
  10
);

const LEASE_KEY_PREFIX = "tenant-rent-payment:create:lease:";
const IP_KEY_PREFIX = "tenant-rent-payment:create:ip:";

export async function assertTenantRentPaymentCreateAllowed(input: {
  clientIp: string;
  leaseId: string;
  redis?: IORedis;
  tenantUserId: string;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const leaseLimit = await consumeFixedWindowRateLimit({
    key: `${LEASE_KEY_PREFIX}${input.tenantUserId}:${input.leaseId}`,
    limit: TENANT_RENT_PAYMENT_CREATE_LEASE_RATE_LIMIT_MAX,
    redis: input.redis,
    windowMs: TENANT_RENT_PAYMENT_CREATE_LEASE_RATE_LIMIT_WINDOW_MS,
  });
  if (!leaseLimit.allowed) {
    return leaseLimit;
  }

  return consumeFixedWindowRateLimit({
    key: `${IP_KEY_PREFIX}${input.tenantUserId}:${input.clientIp}`,
    limit: TENANT_RENT_PAYMENT_CREATE_IP_RATE_LIMIT_MAX,
    redis: input.redis,
    windowMs: TENANT_RENT_PAYMENT_CREATE_IP_RATE_LIMIT_WINDOW_MS,
  });
}

export function getTenantRentPaymentCreateRateLimitErrorMessage(input: {
  limit: number;
  retryAfterSec: number;
  windowMs: number;
}): string {
  const requestWord = input.limit === 1 ? "request" : "requests";
  const windowLabel = formatRateLimitWindow(input.windowMs);
  const retryLabel = formatRateLimitRetryAfter(input.retryAfterSec);

  return `You can start at most ${input.limit} rent payment ${requestWord} every ${windowLabel}. Try again in ${retryLabel}.`;
}
