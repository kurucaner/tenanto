import {
  type TPropertyUnitsListFilters,
  type TPropertyUnitsListSortBy,
  type TPropertyUnitsListSortDir,
  type TUnitOccupancyFilter,
  type TUnitRentalType,
  UNIT_OCCUPANCY_FILTER_VALUES,
  UnitRentalType,
  UNITS_LIST_LIMIT,
  UNITS_LIST_MAX_LIMIT,
} from "@/packages/shared";
import { decodeUnitKeysetCursor } from "@/pagination/keyset-cursor";

import { type TQueryParseResult } from "./admin-query-utils";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQuerySearchFilter,
} from "./parse-list-query-filters";

const UNIT_RENTAL_TYPES = new Set<TUnitRentalType>(Object.values(UnitRentalType));

function parseUnitsListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return UNITS_LIST_LIMIT;
  return Math.min(UNITS_LIST_MAX_LIMIT, Math.floor(n));
}

function parseUnitsListSortBy(raw: unknown): TPropertyUnitsListSortBy | "" | null {
  if (raw === undefined || raw === "") return "";
  if (raw === "type") return "type";
  return null;
}

function parseUnitsListSortDir(raw: unknown): TPropertyUnitsListSortDir | "" | null {
  if (raw === undefined || raw === "") return "";
  if (raw === "asc" || raw === "desc") return raw;
  return null;
}

function parseUnitRentalTypeFilter(raw: unknown): TUnitRentalType | "" | null {
  if (raw === undefined || raw === "") return "";
  if (typeof raw !== "string") return null;
  return UNIT_RENTAL_TYPES.has(raw as TUnitRentalType) ? (raw as TUnitRentalType) : null;
}

function parseUnitOccupancyFilter(raw: unknown): TUnitOccupancyFilter | "" | null {
  if (raw === undefined || raw === "") return "";
  if (typeof raw !== "string") return null;
  if ((UNIT_OCCUPANCY_FILTER_VALUES as readonly string[]).includes(raw)) {
    return raw as TUnitOccupancyFilter;
  }
  return null;
}

export function parsePropertyUnitsListQuery(query: Record<string, unknown>):
  | {
      cursor?: string;
      filters: TPropertyUnitsListFilters;
      isPaginated: boolean;
      limit: number;
      ok: true;
    }
  | { error: string; ok: false } {
  const filters: TPropertyUnitsListFilters = {};

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

  const rentalType = parseUnitRentalTypeFilter(query["rentalType"]);
  if (rentalType === null) {
    return {
      error: `rentalType must be one of: ${[...UNIT_RENTAL_TYPES].join(", ")}`,
      ok: false,
    };
  }
  if (rentalType) {
    filters.rentalType = rentalType;
  }

  const occupancy = parseUnitOccupancyFilter(query["occupancy"]);
  if (occupancy === null) {
    return {
      error: `occupancy must be one of: ${UNIT_OCCUPANCY_FILTER_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (occupancy) {
    filters.occupancy = occupancy;
  }

  const sortBy = parseUnitsListSortBy(query["sortBy"]);
  if (sortBy === null) {
    return { error: 'sortBy must be "type"', ok: false };
  }
  if (sortBy) {
    filters.sortBy = sortBy;
  }

  const sortDir = parseUnitsListSortDir(query["sortDir"]);
  if (sortDir === null) {
    return { error: 'sortDir must be "asc" or "desc"', ok: false };
  }
  if (sortDir) {
    filters.sortDir = sortDir;
  }

  const isPaginated =
    (query["limit"] !== undefined && query["limit"] !== "") ||
    (typeof query["cursor"] === "string" && query["cursor"] !== "");

  const limit = parseUnitsListLimit(query["limit"]);
  const cursor =
    typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

  if (cursor != null) {
    try {
      decodeUnitKeysetCursor(cursor);
    } catch {
      return { error: "Invalid cursor", ok: false };
    }
  }

  return { cursor, filters, isPaginated, limit, ok: true };
}
