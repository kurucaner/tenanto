import type { TIncomeRefundFilter } from "@/packages/shared";
import { INCOME_REFUND_FILTER_VALUES, LIST_SEARCH_MAX_LENGTH } from "@/packages/shared";

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

export function applyOptionalQueryRefundStatusFilter<
  T extends { refundStatus?: TIncomeRefundFilter },
>(query: Record<string, unknown>, filters: T): TQueryParseResult<void> {
  if (query["refundStatus"] === undefined || query["refundStatus"] === "") {
    return { ok: true };
  }

  if (typeof query["refundStatus"] !== "string") {
    return { error: "refundStatus must be a string", ok: false };
  }

  const refundStatus = query["refundStatus"] as TIncomeRefundFilter;
  if (!(INCOME_REFUND_FILTER_VALUES as readonly string[]).includes(refundStatus)) {
    return {
      error: `refundStatus must be one of: ${INCOME_REFUND_FILTER_VALUES.join(", ")}`,
      ok: false,
    };
  }

  filters.refundStatus = refundStatus;
  return { ok: true };
}
