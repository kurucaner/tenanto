import {
  closeRateLimitRedis,
  consumeFixedWindowRateLimit,
} from "@/lib/redis-fixed-window-rate-limit";
import {
  TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_MAX,
  TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/tenant-email-campaign-config";

const KEY_PREFIX = "tenant-email-campaign:create:";

export async function assertTenantEmailCampaignCreateAllowed(
  userId: string,
  propertyId: string
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  return consumeFixedWindowRateLimit({
    key: `${KEY_PREFIX}${userId}:${propertyId}`,
    limit: TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_MAX,
    windowMs: TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_WINDOW_MS,
  });
}

export async function closeTenantEmailCampaignCreateRateLimitRedis(): Promise<void> {
  await closeRateLimitRedis();
}
