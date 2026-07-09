import {
  parseOptionalQueryDate,
  parseOptionalQueryUuid,
  type TQueryParseResult,
} from "./admin-query-utils";

export function applyOptionalQueryDateFilter<T extends object>(
  query: Record<string, unknown>,
  field: string,
  filters: T,
  errorMessage: string
): TQueryParseResult<void> {
  const parsed = parseOptionalQueryDate(query, field, errorMessage);
  if (!parsed.ok) return parsed;
  if (parsed.value) {
    (filters as Record<string, string>)[field] = parsed.value;
  }
  return { ok: true };
}

export function applyOptionalQueryUuidFilter<T extends object>(
  query: Record<string, unknown>,
  field: string,
  filters: T,
  errorMessage: string
): TQueryParseResult<void> {
  const parsed = parseOptionalQueryUuid(query, field, errorMessage);
  if (!parsed.ok) return parsed;
  if (parsed.value) {
    (filters as Record<string, string>)[field] = parsed.value;
  }
  return { ok: true };
}
