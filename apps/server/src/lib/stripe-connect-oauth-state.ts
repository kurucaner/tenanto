import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type IORedis from "ioredis";

import { createRedisConnection } from "@/queues/redis-connection";

const HMAC_ALGORITHM = "sha256";
const REDIS_KEY_PREFIX = "stripe:oauth:state:";
const STATE_SEPARATOR = ".";
export const STRIPE_CONNECT_OAUTH_STATE_TTL_SEC = 600;

export interface IStripeConnectOAuthState {
  propertyId: string;
  userId: string;
}

export class StripeConnectOAuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConnectOAuthStateError";
  }
}

let redisClient: IORedis | null = null;

export function getStripeConnectOAuthRedis(): IORedis {
  if (redisClient == null) {
    redisClient = createRedisConnection();
  }
  return redisClient;
}

export async function closeStripeConnectOAuthRedis(): Promise<void> {
  if (redisClient != null) {
    await redisClient.quit();
    redisClient = null;
  }
}

function oauthStateRedisKey(nonce: string): string {
  return `${REDIS_KEY_PREFIX}${nonce}`;
}

function getOAuthStateSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new StripeConnectOAuthStateError("JWT_SECRET is required for Stripe Connect OAuth state");
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

/** Signs an OAuth state nonce for use as Stripe OAuth `state` query param. */
export function signStripeConnectOAuthStateNonce(nonce: string): string {
  const signature = createHmac(HMAC_ALGORITHM, getOAuthStateSecret()).update(nonce).digest();
  return `${base64UrlEncode(Buffer.from(nonce, "utf8"))}${STATE_SEPARATOR}${base64UrlEncode(signature)}`;
}

/** Returns the nonce when the signed state token is valid; otherwise null. */
export function verifyStripeConnectOAuthStateToken(stateToken: string): string | null {
  const parts = stateToken.split(STATE_SEPARATOR);
  if (parts.length !== 2) {
    return null;
  }

  const nonceB64 = parts[0];
  const signatureB64 = parts[1];
  if (!nonceB64 || !signatureB64) {
    return null;
  }

  let nonce: Buffer;
  let signature: Buffer;
  try {
    nonce = base64UrlDecode(nonceB64);
    signature = base64UrlDecode(signatureB64);
  } catch {
    return null;
  }

  const nonceString = nonce.toString("utf8");
  if (nonceString.length === 0) {
    return null;
  }

  const expected = createHmac(HMAC_ALGORITHM, getOAuthStateSecret()).update(nonceString).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return null;
  }

  return nonceString;
}

/** Creates single-use OAuth state in Redis and returns the signed state token. */
export async function createStripeConnectOAuthState(input: {
  propertyId: string;
  redis?: IORedis;
  ttlSec?: number;
  userId: string;
}): Promise<string> {
  const nonce = randomUUID();
  const redis = input.redis ?? getStripeConnectOAuthRedis();
  const payload: IStripeConnectOAuthState = {
    propertyId: input.propertyId,
    userId: input.userId,
  };

  await redis.set(
    oauthStateRedisKey(nonce),
    JSON.stringify(payload),
    "EX",
    input.ttlSec ?? STRIPE_CONNECT_OAUTH_STATE_TTL_SEC
  );

  return signStripeConnectOAuthStateNonce(nonce);
}

/**
 * Validates and consumes OAuth state (single-use). Returns null when expired,
 * reused, tampered, or when optional expectedUserId does not match.
 */
export async function consumeStripeConnectOAuthState(
  stateToken: string,
  options?: { expectedUserId?: string; redis?: IORedis }
): Promise<IStripeConnectOAuthState | null> {
  const nonce = verifyStripeConnectOAuthStateToken(stateToken);
  if (!nonce) {
    return null;
  }

  const redis = options?.redis ?? getStripeConnectOAuthRedis();
  const raw = await redis.getdel(oauthStateRedisKey(nonce));
  if (!raw) {
    return null;
  }

  let payload: IStripeConnectOAuthState;
  try {
    payload = JSON.parse(raw) as IStripeConnectOAuthState;
  } catch {
    return null;
  }

  if (
    typeof payload.propertyId !== "string" ||
    payload.propertyId.length === 0 ||
    typeof payload.userId !== "string" ||
    payload.userId.length === 0
  ) {
    return null;
  }

  if (options?.expectedUserId && payload.userId !== options.expectedUserId) {
    return null;
  }

  return payload;
}
