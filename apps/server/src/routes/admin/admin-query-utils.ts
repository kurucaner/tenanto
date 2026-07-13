import {
  INCOME_ENTRIES_LIST_LIMIT,
  INCOME_ENTRIES_LIST_MAX_LIMIT,
  UserType,
} from "@/packages/shared";

export function parseIncomeEntriesListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return INCOME_ENTRIES_LIST_LIMIT;
  return Math.min(INCOME_ENTRIES_LIST_MAX_LIMIT, Math.floor(n));
}

export function parseAdminLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(100, Math.floor(n));
}

export function parseIncludeDeleted(raw: unknown): boolean {
  return raw === "true" || raw === "1";
}

export function parseUserTypeFilter(raw: unknown): UserType | undefined {
  if (typeof raw !== "string") return undefined;
  if (raw === UserType.ADMIN) return UserType.ADMIN;
  if (raw === UserType.USER) return UserType.USER;
  return undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns `undefined` if missing/empty, or a valid UUID string, or `null` if invalid. */
export function parseOptionalUuid(raw: unknown): string | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return undefined;
  return UUID_RE.test(t) ? t : null;
}

/** Path/query UUID: non-empty string that matches UUID shape, or `null` if invalid. */
export function parseUuidParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return null;
  return UUID_RE.test(t) ? t : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateString(raw: unknown): string | null {
  if (typeof raw !== "string" || !DATE_RE.test(raw.trim())) return null;
  const date = Date.parse(`${raw.trim()}T00:00:00Z`);
  if (!Number.isFinite(date)) return null;
  return raw.trim();
}

export type TQueryParseResult<T> = { ok: true; value?: T } | { error: string; ok: false };

export function parseOptionalQueryDate(
  query: Record<string, unknown>,
  field: string,
  errorMessage: string
): TQueryParseResult<string> {
  const raw = query[field];
  if (raw === undefined || raw === "") return { ok: true };
  const parsed = parseDateString(raw);
  if (!parsed) return { error: errorMessage, ok: false };
  return { ok: true, value: parsed };
}

export function parseOptionalQueryUuid(
  query: Record<string, unknown>,
  field: string,
  errorMessage: string
): TQueryParseResult<string> {
  const raw = query[field];
  if (raw === undefined || raw === "") return { ok: true };
  const parsed = parseOptionalUuid(raw);
  if (parsed === null) return { error: errorMessage, ok: false };
  if (parsed) return { ok: true, value: parsed };
  return { ok: true };
}
