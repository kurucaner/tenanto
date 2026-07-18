import {
  LEASES_LIST_LIMIT,
  LEASES_LIST_MAX_LIMIT,
  LEASES_SORT_BY_VALUES,
  LEASES_SORT_DIR_VALUES,
  PropertyLongStayStatus,
  type TPropertyLongStaysListFilters,
  type TPropertyLongStayStatus,
} from "@/packages/shared";
import { decodeLeaseKeysetCursor } from "@/pagination/keyset-cursor";

import { type TQueryParseResult } from "./admin-query-utils";
import { parseOptionalEnumValue } from "./parse-enum-value";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQuerySearchFilter,
  applyOptionalQueryUuidFilter,
} from "./parse-list-query-filters";
import { parseOptionalListCursor, validateKeysetCursor } from "./parse-list-query-pagination";

function parseLongStaysListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return LEASES_LIST_LIMIT;
  return Math.min(LEASES_LIST_MAX_LIMIT, Math.floor(n));
}

export function parsePropertyLongStaysListQuery(query: Record<string, unknown>):
  | {
      cursor?: string;
      filters: TPropertyLongStaysListFilters;
      limit: number;
      ok: true;
    }
  | { error: string; ok: false } {
  const filters: TPropertyLongStaysListFilters = {};

  const filterSteps: Array<() => TQueryParseResult<void>> = [
    () => applyOptionalQueryDateFilter(query, "from", filters, "from must be a YYYY-MM-DD date"),
    () => applyOptionalQueryDateFilter(query, "to", filters, "to must be a YYYY-MM-DD date"),
    () => applyOptionalQueryUuidFilter(query, "unitId", filters, "unitId must be a valid UUID"),
    () => applyOptionalQuerySearchFilter(query, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) return result;
  }

  if (query["status"] !== undefined && query["status"] !== "") {
    const status = query["status"];
    if (status !== PropertyLongStayStatus.ACTIVE && status !== PropertyLongStayStatus.ENDED) {
      return { error: "status must be active or ended", ok: false };
    }
    filters.status = status as TPropertyLongStayStatus;
  }

  const sortBy = parseOptionalEnumValue(query["sortBy"], LEASES_SORT_BY_VALUES);
  if (sortBy === null) {
    return {
      error: `sortBy must be one of: ${LEASES_SORT_BY_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (sortBy) {
    filters.sortBy = sortBy;
  }

  const sortDir = parseOptionalEnumValue(query["sortDir"], LEASES_SORT_DIR_VALUES);
  if (sortDir === null) {
    return {
      error: `sortDir must be one of: ${LEASES_SORT_DIR_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (sortDir) {
    filters.sortDir = sortDir;
  }

  const limit = parseLongStaysListLimit(query["limit"]);
  const cursor = parseOptionalListCursor(query);
  const cursorResult = validateKeysetCursor(cursor, decodeLeaseKeysetCursor);
  if (!cursorResult.ok) return cursorResult;

  return { cursor, filters, limit, ok: true };
}
