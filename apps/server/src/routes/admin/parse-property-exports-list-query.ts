import {
  ExportResourceType,
  PROPERTY_EXPORTS_LIST_LIMIT,
  PROPERTY_EXPORTS_LIST_MAX_LIMIT,
  PROPERTY_EXPORTS_SORT_BY_VALUES,
  PROPERTY_EXPORTS_SORT_DIR_VALUES,
  type TExportResourceType,
  type TPropertyExportsListFilters,
  type TPropertyExportsListSortBy,
  type TPropertyExportsListSortDir,
} from "@/packages/shared";
import { decodeExportJobKeysetCursor } from "@/pagination/keyset-cursor";

import { type TQueryParseResult } from "./admin-query-utils";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQuerySearchFilter,
} from "./parse-list-query-filters";

function parseExportsListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return PROPERTY_EXPORTS_LIST_LIMIT;
  return Math.min(PROPERTY_EXPORTS_LIST_MAX_LIMIT, Math.floor(n));
}

function parseExportResourceType(value: unknown): TExportResourceType | "" | null {
  if (value === undefined || value === "") {
    return "";
  }
  if (
    value === ExportResourceType.EXPENSES ||
    value === ExportResourceType.INCOME ||
    value === ExportResourceType.LEASES
  ) {
    return value;
  }
  return null;
}

function parseExportsListSortBy(value: unknown): TPropertyExportsListSortBy | "" | null {
  if (value === undefined || value === "") {
    return "";
  }
  if (typeof value !== "string") {
    return null;
  }
  if ((PROPERTY_EXPORTS_SORT_BY_VALUES as readonly string[]).includes(value)) {
    return value as TPropertyExportsListSortBy;
  }
  return null;
}

function parseExportsListSortDir(value: unknown): TPropertyExportsListSortDir | "" | null {
  if (value === undefined || value === "") {
    return "";
  }
  if (typeof value !== "string") {
    return null;
  }
  if ((PROPERTY_EXPORTS_SORT_DIR_VALUES as readonly string[]).includes(value)) {
    return value as TPropertyExportsListSortDir;
  }
  return null;
}

export function parsePropertyExportsListQuery(query: Record<string, unknown>):
  | {
      cursor?: string;
      filters: TPropertyExportsListFilters;
      limit: number;
      ok: true;
    }
  | { error: string; ok: false } {
  const filters: TPropertyExportsListFilters = {};

  const filterSteps: Array<() => TQueryParseResult<void>> = [
    () => applyOptionalQueryDateFilter(query, "from", filters, "from must be a YYYY-MM-DD date"),
    () => applyOptionalQueryDateFilter(query, "to", filters, "to must be a YYYY-MM-DD date"),
    () => applyOptionalQuerySearchFilter(query, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) {
      return result;
    }
  }

  const resourceType = parseExportResourceType(query["resourceType"]);
  if (resourceType === null) {
    return { error: "resourceType must be expenses, income, or leases", ok: false };
  }
  if (resourceType) {
    filters.resourceType = resourceType;
  }

  const sortBy = parseExportsListSortBy(query["sortBy"]);
  if (sortBy === null) {
    return {
      error: `sortBy must be one of: ${PROPERTY_EXPORTS_SORT_BY_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (sortBy) {
    filters.sortBy = sortBy;
  }

  const sortDir = parseExportsListSortDir(query["sortDir"]);
  if (sortDir === null) {
    return {
      error: `sortDir must be one of: ${PROPERTY_EXPORTS_SORT_DIR_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (sortDir) {
    filters.sortDir = sortDir;
  }

  const limit = parseExportsListLimit(query["limit"]);
  const cursor =
    typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

  if (cursor != null) {
    try {
      decodeExportJobKeysetCursor(cursor);
    } catch {
      return { error: "Invalid cursor", ok: false };
    }
  }

  return { cursor, filters, limit, ok: true };
}
