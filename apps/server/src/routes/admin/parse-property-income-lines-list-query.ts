import { type IPropertyIncomeLinesListQuery } from "@/packages/shared";
import { decodeIncomeLineKeysetCursor } from "@/pagination/keyset-cursor";

import { parseIncomeEntriesListLimit, parseUuidParam, type TQueryParseResult } from "./admin-query-utils";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQueryRefundStatusFilter,
  applyOptionalQuerySearchFilter,
  applyOptionalQueryUuidFilter,
} from "./parse-list-query-filters";
import { parseOptionalListCursor, validateKeysetCursor } from "./parse-list-query-pagination";

export type TIncomeLineListRouteFilters = Omit<IPropertyIncomeLinesListQuery, "cursor" | "limit">;

function parseIncomeLineTypeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return parseUuidParam(raw);
}

export function parsePropertyIncomeLinesListQuery(
  query: Record<string, unknown>
): { filters: IPropertyIncomeLinesListQuery; ok: true } | { error: string; ok: false } {
  const filters: IPropertyIncomeLinesListQuery = {};

  const filterSteps: Array<() => TQueryParseResult<void>> = [
    () => applyOptionalQueryDateFilter(query, "from", filters, "from must be a YYYY-MM-DD date"),
    () => applyOptionalQueryDateFilter(query, "to", filters, "to must be a YYYY-MM-DD date"),
    () => applyOptionalQueryUuidFilter(query, "unitId", filters, "unitId must be a valid UUID"),
    () =>
      applyOptionalQueryUuidFilter(
        query,
        "reservationId",
        filters,
        "reservationId must be a valid UUID"
      ),
    () =>
      applyOptionalQueryUuidFilter(query, "longStayId", filters, "longStayId must be a valid UUID"),
    () => applyOptionalQuerySearchFilter(query, filters),
    () => applyOptionalQueryRefundStatusFilter(query, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) return result;
  }

  if (query["incomeLineTypeId"] !== undefined && query["incomeLineTypeId"] !== "") {
    const incomeLineTypeId = parseIncomeLineTypeId(query["incomeLineTypeId"]);
    if (incomeLineTypeId === null) {
      return { error: "incomeLineTypeId must be a valid UUID", ok: false };
    }
    filters.incomeLineTypeId = incomeLineTypeId;
  }

  return { filters, ok: true };
}

export function parsePropertyIncomeLinesListQueryPaginated(
  query: Record<string, unknown>
):
  | { cursor?: string; filters: TIncomeLineListRouteFilters; limit: number; ok: true }
  | { error: string; ok: false } {
  const parsed = parsePropertyIncomeLinesListQuery(query);
  if (!parsed.ok) {
    return parsed;
  }

  const limit = parseIncomeEntriesListLimit(query["limit"]);
  const cursor = parseOptionalListCursor(query);
  const cursorResult = validateKeysetCursor(cursor, decodeIncomeLineKeysetCursor);
  if (!cursorResult.ok) return cursorResult;

  return { cursor, filters: parsed.filters, limit, ok: true };
}
