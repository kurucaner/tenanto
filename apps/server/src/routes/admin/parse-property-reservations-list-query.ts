import {
  type IPropertyReservationsListQuery,
  ReservationStatus,
  type TReservationStatus,
  type TUnitRentalType,
  UnitRentalType,
} from "@/packages/shared";
import { decodeReservationKeysetCursor } from "@/pagination/keyset-cursor";

import {
  parseIncomeEntriesListLimit,
  parseUuidParam,
  type TQueryParseResult,
} from "./admin-query-utils";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQueryRefundStatusFilter,
  applyOptionalQuerySearchFilter,
  applyOptionalQueryUuidFilter,
} from "./parse-list-query-filters";
import { parseOptionalListCursor, validateKeysetCursor } from "./parse-list-query-pagination";

const RESERVATION_STATUSES = new Set<TReservationStatus>(Object.values(ReservationStatus));
const UNIT_RENTAL_TYPES = new Set<TUnitRentalType>(Object.values(UnitRentalType));

function parseReservationStatus(raw: unknown): TReservationStatus | null {
  if (typeof raw !== "string") return null;
  return RESERVATION_STATUSES.has(raw as TReservationStatus) ? (raw as TReservationStatus) : null;
}

function parseReservationRentalTypeFilter(
  query: Record<string, unknown>,
  filters: IPropertyReservationsListQuery
): { error: string; ok: false } | { ok: true } {
  if (query["rentalType"] === undefined || query["rentalType"] === "") {
    return { ok: true };
  }
  if (typeof query["rentalType"] !== "string") {
    return { error: "rentalType must be a string", ok: false };
  }
  if (!UNIT_RENTAL_TYPES.has(query["rentalType"] as TUnitRentalType)) {
    return {
      error: `rentalType must be one of: ${[...UNIT_RENTAL_TYPES].join(", ")}`,
      ok: false,
    };
  }
  filters.rentalType = query["rentalType"] as TUnitRentalType;
  return { ok: true };
}

export type TReservationListRouteFilters = Omit<IPropertyReservationsListQuery, "cursor" | "limit">;

export function parsePropertyReservationsListQuery(
  query: Record<string, unknown>
):
  | { cursor?: string; filters: TReservationListRouteFilters; limit: number; ok: true }
  | { error: string; ok: false } {
  const filters: TReservationListRouteFilters = {};

  const filterSteps: Array<
    () => TQueryParseResult<void> | { error: string; ok: false } | { ok: true }
  > = [
    () => applyOptionalQueryDateFilter(query, "from", filters, "from must be a YYYY-MM-DD date"),
    () => applyOptionalQueryDateFilter(query, "to", filters, "to must be a YYYY-MM-DD date"),
    () =>
      applyOptionalQueryDateFilter(
        query,
        "checkOutFrom",
        filters,
        "checkOutFrom must be a YYYY-MM-DD date"
      ),
    () =>
      applyOptionalQueryDateFilter(
        query,
        "checkInTo",
        filters,
        "checkInTo must be a YYYY-MM-DD date"
      ),
    () => applyOptionalQueryUuidFilter(query, "unitId", filters, "unitId must be a valid UUID"),
    () =>
      applyOptionalQueryUuidFilter(
        query,
        "includeReservationId",
        filters,
        "includeReservationId must be a valid UUID"
      ),
    () => parseReservationRentalTypeFilter(query, filters),
    () => applyOptionalQuerySearchFilter(query, filters),
    () => applyOptionalQueryRefundStatusFilter(query, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) return result;
  }

  if (query["channelCommissionId"] !== undefined && query["channelCommissionId"] !== "") {
    const channelCommissionId = parseUuidParam(query["channelCommissionId"]);
    if (channelCommissionId === null) {
      return {
        error: "channelCommissionId must be a valid UUID",
        ok: false,
      };
    }
    filters.channelCommissionId = channelCommissionId;
  }

  if (query["status"] !== undefined && query["status"] !== "") {
    const status = parseReservationStatus(query["status"]);
    if (status === null) {
      return {
        error: `status must be one of: ${[...RESERVATION_STATUSES].join(", ")}`,
        ok: false,
      };
    }
    filters.status = status;
  }

  const limit = parseIncomeEntriesListLimit(query["limit"]);
  const cursor = parseOptionalListCursor(query);
  const cursorResult = validateKeysetCursor(cursor, decodeReservationKeysetCursor);
  if (!cursorResult.ok) return cursorResult;

  return { cursor, filters, limit, ok: true };
}
