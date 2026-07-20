import type IORedis from "ioredis";

import { formatRateLimitRetryAfter, formatRateLimitWindow } from "@/lib/rate-limit-messages";
import { consumeFixedWindowRateLimit } from "@/lib/redis-fixed-window-rate-limit";
import {
  STRIPE_CONNECT_LINK_RATE_LIMIT_MAX,
  STRIPE_CONNECT_LINK_RATE_LIMIT_WINDOW_MS,
} from "@/lib/stripe-connect-rate-limit-config";

const KEY_PREFIX = "stripe-connect:link:";

export async function assertPropertyStripeConnectLinkAllowed(
  propertyId: string,
  userId: string,
  redis?: IORedis
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  return consumeFixedWindowRateLimit({
    key: `${KEY_PREFIX}${propertyId}:${userId}`,
    limit: STRIPE_CONNECT_LINK_RATE_LIMIT_MAX,
    redis,
    windowMs: STRIPE_CONNECT_LINK_RATE_LIMIT_WINDOW_MS,
  });
}

export function getPropertyStripeConnectRateLimitErrorMessage(input: {
  limit: number;
  retryAfterSec: number;
  windowMs: number;
}): string {
  const requestWord = input.limit === 1 ? "request" : "requests";
  const windowLabel = formatRateLimitWindow(input.windowMs);
  const retryLabel = formatRateLimitRetryAfter(input.retryAfterSec);

  return `You can start Stripe Connect at most ${input.limit} ${requestWord} per property every ${windowLabel}. Try again in ${retryLabel}.`;
}
