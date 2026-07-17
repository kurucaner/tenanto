import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generatePropertyMemberInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPropertyMemberInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time compare of a raw invite token against a stored SHA-256 hex digest.
 */
export function propertyMemberInviteTokenMatchesHash(token: string, expectedHash: string): boolean {
  const actualHex = hashPropertyMemberInviteToken(token);
  if (actualHex.length !== expectedHash.length) {
    return false;
  }

  try {
    const actual = Buffer.from(actualHex, "hex");
    const expected = Buffer.from(expectedHash, "hex");
    if (actual.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function buildPropertyMemberInviteAcceptUrl(token: string): string {
  const base = (process.env.PLATFORM_APP_URL ?? "").replace(/\/$/, "");
  if (!base) {
    throw new Error("PLATFORM_APP_URL is required for property member invite links");
  }
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}
