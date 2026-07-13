import { LIST_SEARCH_MAX_LENGTH } from "@/packages/shared";

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

export function applyOptionalQuerySearchFilter<T extends { q?: string }>(
  query: Record<string, unknown>,
  filters: T
): TQueryParseResult<void> {
  if (query["q"] === undefined || query["q"] === "") {
    return { ok: true };
  }

  if (typeof query["q"] !== "string") {
    return { error: "q must be a string", ok: false };
  }

  const q = query["q"].trim();
  if (q.length > LIST_SEARCH_MAX_LENGTH) {
    return {
      error: `q must be at most ${LIST_SEARCH_MAX_LENGTH} characters`,
      ok: false,
    };
  }

  if (q !== "") {
    filters.q = q;
  }

  return { ok: true };
}
