import { parseUuidParam } from "./admin-query-utils";

export type TParseResult<T> = { ok: true; value: T } | { error: string; ok: false };

export function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function parseMoney(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

/** `undefined` = omit; `null` = clear/none; number = non-negative money. */
export function parseOptionalNullableMoney(
  raw: unknown,
  fieldLabel: string
): TParseResult<number | null | undefined> {
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  if (raw === null) {
    return { ok: true, value: null };
  }
  const money = parseMoney(raw);
  if (money === null) {
    return { error: `${fieldLabel} must be a non-negative number`, ok: false };
  }
  return { ok: true, value: money };
}

export function parseOptionalUuidField(
  raw: unknown,
  fieldLabel: string
): TParseResult<string | undefined> {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: undefined };
  }
  const parsed = parseUuidParam(raw);
  if (parsed === null) {
    return { error: `${fieldLabel} must be a valid UUID`, ok: false };
  }
  return { ok: true, value: parsed };
}

export function parseNullableUuidField(
  raw: unknown,
  fieldLabel: string
): TParseResult<string | null> {
  if (raw === null || raw === "") {
    return { ok: true, value: null };
  }
  const parsed = parseUuidParam(raw);
  if (parsed === null) {
    return { error: `${fieldLabel} must be a valid UUID or null`, ok: false };
  }
  return { ok: true, value: parsed };
}

export function parseOptionalTrimmedStringField(
  raw: unknown,
  fieldLabel: string
): TParseResult<string | undefined> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: undefined };
  }
  if (typeof raw !== "string") {
    return { error: `${fieldLabel} must be a string`, ok: false };
  }
  return { ok: true, value: raw.trim() };
}

export function parseNullableTrimmedStringField(
  raw: unknown,
  fieldLabel: string
): TParseResult<string | null> {
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { error: `${fieldLabel} must be a string or null`, ok: false };
  }
  return { ok: true, value: raw.trim() };
}

export function parseOptionalPeriodMonthField(
  raw: unknown,
  fieldLabel: string
): TParseResult<string | undefined> {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: undefined };
  }
  if (typeof raw !== "string") {
    return { error: `${fieldLabel} must be a string`, ok: false };
  }
  return { ok: true, value: raw.trim() };
}

export function parseNullablePeriodMonthField(
  raw: unknown,
  fieldLabel: string
): TParseResult<string | null> {
  if (raw === null || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { error: `${fieldLabel} must be a string or null`, ok: false };
  }
  return { ok: true, value: raw.trim() };
}
