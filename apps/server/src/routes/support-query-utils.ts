import {
  type IAdminSupportRequestPatchBody,
  type SupportCategory,
  type SupportRequestStatus,
  type TAdminSupportRequestSettableStatus,
} from "@/packages/shared";

const ADMIN_SUPPORT_SETTABLE_STATUSES = new Set<TAdminSupportRequestSettableStatus>([
  "in_progress",
  "resolved",
]);

const SUPPORT_STATUSES = new Set<SupportRequestStatus>(["pending", "in_progress", "resolved"]);
const SUPPORT_CATEGORIES = new Set<SupportCategory>(["bug", "feature", "general"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Missing/empty → `undefined`; invalid shape → `null`; otherwise parsed status. */
export function parseOptionalSupportRequestStatus(
  raw: unknown
): SupportRequestStatus | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return SUPPORT_STATUSES.has(raw as SupportRequestStatus) ? (raw as SupportRequestStatus) : null;
}

/** Missing/empty → `undefined`; invalid shape → `null`; otherwise parsed category. */
export function parseOptionalSupportCategory(raw: unknown): SupportCategory | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return SUPPORT_CATEGORIES.has(raw as SupportCategory) ? (raw as SupportCategory) : null;
}

export function parseSupportListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(100, Math.floor(n));
}

export function parseUuidParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return null;
  return UUID_RE.test(t) ? t : null;
}

export function parseSupportRequestPatchBody(
  raw: unknown
): { body: IAdminSupportRequestPatchBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const record = raw as Record<string, unknown>;
  const status = record["status"];
  if (
    typeof status !== "string" ||
    !ADMIN_SUPPORT_SETTABLE_STATUSES.has(status as TAdminSupportRequestSettableStatus)
  ) {
    return { error: 'status must be "in_progress" or "resolved"', ok: false };
  }
  return { body: { status: status as TAdminSupportRequestSettableStatus }, ok: true };
}

export function parseSupportMessageBody(
  raw: unknown
): { body: string; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const record = raw as Record<string, unknown>;
  const message = typeof record["message"] === "string" ? record["message"].trim() : "";
  if (message.length === 0) {
    return { error: "message is required", ok: false };
  }
  if (message.length > 2000) {
    return { error: "message must be at most 2000 characters", ok: false };
  }
  return { body: message, ok: true };
}

export function isValidSupportCategory(value: unknown): value is SupportCategory {
  return typeof value === "string" && SUPPORT_CATEGORIES.has(value as SupportCategory);
}
