import { createHmac, timingSafeEqual } from "node:crypto";

const ALGORITHM = "sha256";
const SEPARATOR = ".";

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export function createUnsubscribeToken(email: string): string {
  const secret = process.env.AWS_INTERNAL_SECRET;
  if (!secret) throw new Error("AWS_INTERNAL_SECRET required for unsubscribe tokens");

  const payload = email.toLowerCase().trim();
  const signature = createHmac(ALGORITHM, secret).update(payload).digest();
  return `${base64UrlEncode(Buffer.from(payload, "utf8"))}${SEPARATOR}${base64UrlEncode(signature)}`;
}

export function buildListUnsubscribeUrl(email: string): string {
  const apiUrl = (process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!apiUrl) throw new Error("API_PUBLIC_URL is required for unsubscribe links");
  const token = createUnsubscribeToken(email);
  return `${apiUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const secret = process.env.AWS_INTERNAL_SECRET;
  if (!secret) return null;

  const parts = token.split(SEPARATOR);
  if (parts.length !== 2) return null;

  const payloadB64 = parts[0];
  const signatureB64 = parts[1];
  if (!payloadB64 || !signatureB64) return null;

  let payload: Buffer;
  let signature: Buffer;
  try {
    payload = base64UrlDecode(payloadB64);
    signature = base64UrlDecode(signatureB64);
  } catch {
    return null;
  }

  const expected = createHmac(ALGORITHM, secret).update(payload).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return null;
  }

  return payload.toString("utf8");
}
