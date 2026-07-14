import type IORedis from "ioredis";

import {
  TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_MAX,
  TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/tenant-email-campaign-config";
import { isTenantEmailCampaignCreateRateLimitExceeded } from "@/lib/tenant-email-campaign-limits";
import { createRedisConnection } from "@/queues/redis-connection";

const KEY_PREFIX = "tenant-email-campaign:create:";

let redisClient: IORedis | null = null;

function getRedisClient(): IORedis {
  if (redisClient == null) {
    redisClient = createRedisConnection();
  }
  return redisClient;
}

export async function assertTenantEmailCampaignCreateAllowed(
  userId: string,
  propertyId: string
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const key = `${KEY_PREFIX}${userId}:${propertyId}`;
  const windowSec = Math.max(
    1,
    Math.ceil(TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_WINDOW_MS / 1000)
  );
  const redis = getRedisClient();
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSec);
  }

  if (
    isTenantEmailCampaignCreateRateLimitExceeded(count, TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_MAX)
  ) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfterSec: Math.max(ttl, 1) };
  }

  return { allowed: true };
}

export async function closeTenantEmailCampaignCreateRateLimitRedis(): Promise<void> {
  if (redisClient != null) {
    await redisClient.quit();
    redisClient = null;
  }
}
