import { formatRateLimitRetryAfter, formatRateLimitWindow } from "@/lib/rate-limit-messages";
import { consumeFixedWindowRateLimit } from "@/lib/redis-fixed-window-rate-limit";
import {
  TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_MAX,
  TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/tenant-portal-rate-limit-config";

const KEY_PREFIX = "tenant-portal-invite:create:";

export async function assertTenantPortalInviteCreateAllowed(
  leaseId: string
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  return consumeFixedWindowRateLimit({
    key: `${KEY_PREFIX}${leaseId}`,
    limit: TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_MAX,
    windowMs: TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_WINDOW_MS,
  });
}

export function getTenantPortalInviteCreateRateLimitErrorMessage(input: {
  limit: number;
  retryAfterSec: number;
  windowMs: number;
}): string {
  const inviteWord = input.limit === 1 ? "invite" : "invites";
  const windowLabel = formatRateLimitWindow(input.windowMs);
  const retryLabel = formatRateLimitRetryAfter(input.retryAfterSec);

  return `You can send at most ${input.limit} portal ${inviteWord} per lease every ${windowLabel}. Try again in ${retryLabel}.`;
}
