import type { RedisOptions } from "ioredis";
import IORedis from "ioredis";

function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;

  return {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port || "6379", 10),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export function getRedisConnectionOptions(): RedisOptions {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return {
      ...parseRedisUrl(url),
      maxRetriesPerRequest: null,
    };
  }

  const password = process.env.REDIS_PASSWORD ?? process.env.REDISPASSWORD;
  const username = process.env.REDISUSER ?? process.env.REDIS_USER;

  return {
    host: process.env.REDISHOST ?? process.env.REDIS_HOST ?? "127.0.0.1",
    maxRetriesPerRequest: null,
    port: Number.parseInt(process.env.REDISPORT ?? process.env.REDIS_PORT ?? "6379", 10),
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  };
}

export function createRedisConnection(): IORedis {
  return new IORedis(getRedisConnectionOptions());
}

export async function verifyRedisConnection(): Promise<boolean> {
  const connection = createRedisConnection();
  try {
    const pong = await connection.ping();
    return pong === "PONG";
  } finally {
    connection.disconnect();
  }
}
