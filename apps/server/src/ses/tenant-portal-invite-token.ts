import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generatePortalInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPortalInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time compare of a raw invite token against a stored SHA-256 hex digest.
 * Used after DB lookup so verification is not only SQL string equality on the hash.
 */
export function portalInviteTokenMatchesHash(token: string, expectedHash: string): boolean {
  const actualHex = hashPortalInviteToken(token);
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

export function buildPortalInviteAcceptUrl(token: string): string {
  const base = (process.env.TENANT_APP_URL ?? "").replace(/\/$/, "");
  if (!base) {
    throw new Error("TENANT_APP_URL is required for portal invite links");
  }
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}
