import { afterEach, describe, expect, test } from "bun:test";

import { getRedisConnectionOptions } from "./redis-connection";

describe("getRedisConnectionOptions", () => {
  const originalUrl = process.env.REDIS_URL;
  const originalHost = process.env.REDISHOST;
  const originalPort = process.env.REDISPORT;

  afterEach(() => {
    process.env.REDIS_URL = originalUrl;
    process.env.REDISHOST = originalHost;
    process.env.REDISPORT = originalPort;
  });

  test("parses REDIS_URL into host and port for BullMQ", () => {
    process.env.REDIS_URL = "redis://default:secret@redis.railway.internal:6379";
    delete process.env.REDISHOST;
    delete process.env.REDISPORT;

    expect(getRedisConnectionOptions()).toEqual({
      host: "redis.railway.internal",
      maxRetriesPerRequest: null,
      password: "secret",
      port: 6379,
      username: "default",
    });
  });

  test("does not default to localhost when REDIS_URL is set", () => {
    process.env.REDIS_URL = "redis://default:secret@redis.railway.internal:6379";

    const options = getRedisConnectionOptions();

    expect(options.host).not.toBe("127.0.0.1");
    expect(options.host).toBe("redis.railway.internal");
  });

  test("falls back to REDISHOST and REDISPORT without REDIS_URL", () => {
    delete process.env.REDIS_URL;
    process.env.REDISHOST = "redis.example.com";
    process.env.REDISPORT = "6380";

    expect(getRedisConnectionOptions()).toEqual({
      host: "redis.example.com",
      maxRetriesPerRequest: null,
      port: 6380,
    });
  });
});
