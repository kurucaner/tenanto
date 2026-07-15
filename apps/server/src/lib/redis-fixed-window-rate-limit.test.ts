import { describe, expect, mock, test } from "bun:test";

import {
  consumeFixedWindowRateLimit,
  isFixedWindowRateLimitExceeded,
} from "./redis-fixed-window-rate-limit";

describe("isFixedWindowRateLimitExceeded", () => {
  test("allows requests up to the limit", () => {
    expect(isFixedWindowRateLimitExceeded(5, 5)).toBe(false);
    expect(isFixedWindowRateLimitExceeded(6, 5)).toBe(true);
  });
});

describe("consumeFixedWindowRateLimit", () => {
  test("allows counts within the limit and denies when exceeded", async () => {
    const incr = mock(() => Promise.resolve(1));
    const expire = mock(() => Promise.resolve(1));
    const ttl = mock(() => Promise.resolve(42));
    const redis = { expire, incr, ttl } as never;

    const first = await consumeFixedWindowRateLimit({
      key: "test:key",
      limit: 2,
      redis,
      windowMs: 60_000,
    });
    expect(first).toEqual({ allowed: true });
    expect(expire).toHaveBeenCalledWith("test:key", 60);

    incr.mockResolvedValueOnce(2);
    const second = await consumeFixedWindowRateLimit({
      key: "test:key",
      limit: 2,
      redis,
      windowMs: 60_000,
    });
    expect(second).toEqual({ allowed: true });

    incr.mockResolvedValueOnce(3);
    const third = await consumeFixedWindowRateLimit({
      key: "test:key",
      limit: 2,
      redis,
      windowMs: 60_000,
    });
    expect(third).toEqual({ allowed: false, retryAfterSec: 42 });
  });
});
