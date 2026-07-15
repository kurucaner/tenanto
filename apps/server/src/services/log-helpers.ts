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

/** Strip sensitive query params from URL logs (JWTs, invite tokens). */
export function redactSensitiveQueryParamsFromUrl(url: string): string {
  try {
    const u = new URL(url, "http://localhost");
    for (const key of ["access_token", "refresh_token", "token"] as const) {
      if (u.searchParams.has(key)) {
        u.searchParams.set(key, "[REDACTED]");
      }
    }
    return u.pathname + u.search;
  } catch {
    return url.replaceAll(
      /([?&])(access_token|refresh_token|token)=[^&]*/gi,
      "$1$2=[REDACTED]"
    );
  }
}

/** @deprecated Prefer redactSensitiveQueryParamsFromUrl */
export function redactAccessTokenFromUrl(url: string): string {
  return redactSensitiveQueryParamsFromUrl(url);
}

export function getLogMessage(request: FastifyRequest, statusCode: number): string {
  return `${request.method} ${redactSensitiveQueryParamsFromUrl(request.url)} ${statusCode}`;
}
