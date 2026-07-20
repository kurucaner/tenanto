import { type TQueryParseResult } from "./admin-query-utils";

export function parseOptionalEnumValue<T extends string>(
  raw: unknown,
  allowedValues: readonly T[]
): T | "" | null {
  if (raw === undefined || raw === "") {
    return "";
  }
  if (typeof raw !== "string") {
    return null;
  }
  if ((allowedValues as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return null;
}

export function applyOptionalQueryEnumFilter<T extends object, V extends string>(
  query: Record<string, unknown>,
  field: string,
  filters: T,
  allowedValues: readonly V[],
  errorMessage: string
): TQueryParseResult<void> {
  if (query[field] === undefined || query[field] === "") {
    return { ok: true };
  }
  const parsed = parseOptionalEnumValue(query[field], allowedValues);
  if (parsed === null) {
    return { error: errorMessage, ok: false };
  }
  if (parsed) {
    (filters as Record<string, V>)[field] = parsed;
  }
  return { ok: true };
}
