/**
 * Opaque keyset cursor (v1): ISO `createdAt` + UUID `id`, base64url-encoded JSON.
 * Not signed or encrypted; do not embed secrets. For tamper-evident cursors, use a dedicated signed format.
 */
export type KeysetCursorV1 = {
  createdAt: string;
  id: string;
};

export function decodeKeysetCursor(raw: string): KeysetCursorV1 {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      throw new TypeError("invalid shape");
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeKeysetCursor(createdAt: Date | string, id: string): string {
  const iso = typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  return Buffer.from(JSON.stringify({ createdAt: iso, id }), "utf8").toString("base64url");
}
