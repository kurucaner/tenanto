import { createHash, randomBytes } from "node:crypto";

export function generatePortalInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPortalInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildPortalInviteAcceptUrl(token: string): string {
  const base = (process.env.TENANT_APP_URL ?? "").replace(/\/$/, "");
  if (!base) {
    throw new Error("TENANT_APP_URL is required for portal invite links");
  }
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}
