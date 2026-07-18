import { afterEach, describe, expect, test } from "bun:test";

import { mockAsyncFn } from "@/test-fixtures/mocks";

import {
  consumeStripeConnectOAuthState,
  createStripeConnectOAuthState,
  signStripeConnectOAuthStateNonce,
  STRIPE_CONNECT_OAUTH_STATE_TTL_SEC,
  verifyStripeConnectOAuthStateToken,
} from "./stripe-connect-oauth-state";

describe("stripe-connect-oauth-state signing", () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  test("verify returns null for tampered signature", () => {
    process.env.JWT_SECRET = "test-oauth-state-secret";
    const token = signStripeConnectOAuthStateNonce("nonce-123");
    const tampered = `${token.slice(0, -1)}x`;
    expect(verifyStripeConnectOAuthStateToken(tampered)).toBeNull();
  });

  test("verify returns null for malformed token", () => {
    process.env.JWT_SECRET = "test-oauth-state-secret";
    expect(verifyStripeConnectOAuthStateToken("not-a-valid-token")).toBeNull();
  });

  test("verify round-trips a signed nonce", () => {
    process.env.JWT_SECRET = "test-oauth-state-secret";
    const nonce = "nonce-abc";
    const token = signStripeConnectOAuthStateNonce(nonce);
    expect(verifyStripeConnectOAuthStateToken(token)).toBe(nonce);
  });
});

describe("createStripeConnectOAuthState", () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  test("stores payload in Redis with TTL and returns signed token", async () => {
    process.env.JWT_SECRET = "test-oauth-state-secret";
    const set = mockAsyncFn(() => Promise.resolve("OK"));
    const redis = { set } as never;

    const token = await createStripeConnectOAuthState({
      propertyId: "property-1",
      redis,
      userId: "user-1",
    });

    expect(set).toHaveBeenCalledTimes(1);
    const [key, value, expiryMode, ttlSec] = set.mock.calls[0] as unknown as [
      string,
      string,
      string,
      number,
    ];
    expect(key.startsWith("stripe:oauth:state:")).toBe(true);
    expect(JSON.parse(value)).toEqual({
      propertyId: "property-1",
      userId: "user-1",
    });
    expect(expiryMode).toBe("EX");
    expect(ttlSec).toBe(STRIPE_CONNECT_OAUTH_STATE_TTL_SEC);
    expect(verifyStripeConnectOAuthStateToken(token)).not.toBeNull();
  });
});

describe("consumeStripeConnectOAuthState", () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  test("returns payload once then null on reuse (single-use)", async () => {
    process.env.JWT_SECRET = "test-oauth-state-secret";
    const storedPayload = JSON.stringify({
      propertyId: "property-1",
      userId: "user-1",
    });
    const getdel = mockAsyncFn(() => Promise.resolve(storedPayload));
    const redis = { getdel } as never;
    const token = signStripeConnectOAuthStateNonce("nonce-reuse");

    const first = await consumeStripeConnectOAuthState(token, { redis });
    expect(first).toEqual({
      propertyId: "property-1",
      userId: "user-1",
    });

    getdel.mockResolvedValueOnce(null);
    const second = await consumeStripeConnectOAuthState(token, { redis });
    expect(second).toBeNull();
  });

  test("returns null when Redis entry is missing (expired)", async () => {
    process.env.JWT_SECRET = "test-oauth-state-secret";
    const getdel = mockAsyncFn(() => Promise.resolve(null));
    const redis = { getdel } as never;
    const token = signStripeConnectOAuthStateNonce("nonce-expired");

    const result = await consumeStripeConnectOAuthState(token, { redis });
    expect(result).toBeNull();
  });

  test("returns null when expectedUserId does not match", async () => {
    process.env.JWT_SECRET = "test-oauth-state-secret";
    const getdel = mockAsyncFn(() =>
      Promise.resolve(
        JSON.stringify({
          propertyId: "property-1",
          userId: "user-1",
        })
      )
    );
    const redis = { getdel } as never;
    const token = signStripeConnectOAuthStateNonce("nonce-user");

    const result = await consumeStripeConnectOAuthState(token, {
      expectedUserId: "other-user",
      redis,
    });
    expect(result).toBeNull();
  });

  test("returns null for invalid signature without touching Redis", async () => {
    process.env.JWT_SECRET = "test-oauth-state-secret";
    const getdel = mockAsyncFn(() => Promise.resolve(null));
    const redis = { getdel } as never;

    const result = await consumeStripeConnectOAuthState("bad.token", { redis });
    expect(result).toBeNull();
    expect(getdel).not.toHaveBeenCalled();
  });
});
