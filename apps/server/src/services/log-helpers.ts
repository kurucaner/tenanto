import { type FastifyRequest } from "fastify";

const REDACT_KEYS = new Set(["password", "passwordConfirm", "token"]);

export function headerXUserId(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const v = headers["x-user-id"];
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

/** Shallow + nested redaction for log payloads (matches prior pino redact paths). */
export function sanitizeForLog(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  const obj = { ...(value as Record<string, unknown>) };
  for (const key of REDACT_KEYS) {
    if (key in obj) obj[key] = "[REDACTED]";
  }
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      obj[key] = sanitizeForLog(v);
    }
  }
  return obj;
}

/** Strip JWT from URL query logs (HLS manifest `access_token`). */
export function redactAccessTokenFromUrl(url: string): string {
  try {
    const u = new URL(url, "http://localhost");
    if (u.searchParams.has("access_token")) {
      u.searchParams.set("access_token", "[REDACTED]");
    }
    return u.pathname + u.search;
  } catch {
    return url.replaceAll(/([?&])access_token=[^&]*/gi, "$1access_token=[REDACTED]");
  }
}

export function getLogMessage(request: FastifyRequest, statusCode: number): string {
  return `${request.method} ${redactAccessTokenFromUrl(request.url)} ${statusCode}`;
}
