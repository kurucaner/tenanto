import type IORedis from "ioredis";

import { createRedisConnection } from "@/queues/redis-connection";

let redisClient: IORedis | null = null;

export function getRateLimitRedis(): IORedis {
  if (redisClient == null) {
    redisClient = createRedisConnection();
  }
  return redisClient;
}

export async function closeRateLimitRedis(): Promise<void> {
  if (redisClient != null) {
    await redisClient.quit();
    redisClient = null;
  }
}

export function isFixedWindowRateLimitExceeded(requestCount: number, limit: number): boolean {
  return requestCount > limit;
}

export async function consumeFixedWindowRateLimit(input: {
  key: string;
  limit: number;
  redis?: IORedis;
  windowMs: number;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const redis = input.redis ?? getRateLimitRedis();
  const windowSec = Math.max(1, Math.ceil(input.windowMs / 1000));
  const count = await redis.incr(input.key);

  if (count === 1) {
    await redis.expire(input.key, windowSec);
  }

  if (isFixedWindowRateLimitExceeded(count, input.limit)) {
    const ttl = await redis.ttl(input.key);
    return { allowed: false, retryAfterSec: Math.max(ttl, 1) };
  }

  return { allowed: true };
}
