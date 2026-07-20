import { describe, expect, test } from "bun:test";

import { mockResolved } from "@/test-fixtures/mocks";

import {
  assertPropertyStripeConnectLinkAllowed,
  getPropertyStripeConnectRateLimitErrorMessage,
} from "./property-stripe-connect-rate-limit";

describe("getPropertyStripeConnectRateLimitErrorMessage", () => {
  test("includes the configured limit, window, and retry time", () => {
    expect(
      getPropertyStripeConnectRateLimitErrorMessage({
        limit: 10,
        retryAfterSec: 847,
        windowMs: 900_000,
      })
    ).toBe(
      "You can start Stripe Connect at most 10 requests per property every 15 minutes. Try again in 15 minutes."
    );
  });

  test("uses singular request wording for a limit of one", () => {
    expect(
      getPropertyStripeConnectRateLimitErrorMessage({
        limit: 1,
        retryAfterSec: 45,
        windowMs: 60_000,
      })
    ).toBe(
      "You can start Stripe Connect at most 1 request per property every 1 minute. Try again in 45 seconds."
    );
  });
});

describe("assertPropertyStripeConnectLinkAllowed", () => {
  test("allows counts within the limit and denies when exceeded", async () => {
    const incr = mockResolved(1);
    const expire = mockResolved(1);
    const ttl = mockResolved(42);
    const redis = { expire, incr, ttl } as never;

    const first = await assertPropertyStripeConnectLinkAllowed("property-1", "user-1", redis);
    expect(first).toEqual({ allowed: true });
    expect(incr).toHaveBeenCalledWith("stripe-connect:link:property-1:user-1");
    expect(expire).toHaveBeenCalledWith("stripe-connect:link:property-1:user-1", 900);

    incr.mockResolvedValueOnce(10);
    const withinLimit = await assertPropertyStripeConnectLinkAllowed("property-1", "user-1", redis);
    expect(withinLimit).toEqual({ allowed: true });

    incr.mockResolvedValueOnce(11);
    const exceeded = await assertPropertyStripeConnectLinkAllowed("property-1", "user-1", redis);
    expect(exceeded).toEqual({ allowed: false, retryAfterSec: 42 });
  });
});
