import type { RedisOptions } from "ioredis";
import IORedis from "ioredis";

export function getRedisConnectionOptions(): RedisOptions {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return {
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    maxRetriesPerRequest: null,
    port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10),
  };
}

export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return new IORedis(url, getRedisConnectionOptions());
  }

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
