import {
  type IPropertyReportsQuery,
  ReportRentalTypeFilter,
  ReservationChannel,
  type TReportRentalTypeFilter,
  type TReservationChannel,
} from "@/packages/shared";

import { parseOptionalUuid } from "./admin-query-utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REPORT_RENTAL_TYPES = new Set<TReportRentalTypeFilter>(
  Object.values(ReportRentalTypeFilter)
);
const RESERVATION_CHANNELS = new Set<TReservationChannel>(Object.values(ReservationChannel));

function parseDateString(raw: unknown): string | null {
  if (typeof raw !== "string" || !DATE_RE.test(raw.trim())) return null;
  const date = Date.parse(`${raw.trim()}T00:00:00Z`);
  if (!Number.isFinite(date)) return null;
  return raw.trim();
}

function parseReservationChannel(raw: unknown): TReservationChannel | null {
  if (typeof raw !== "string") return null;
  return RESERVATION_CHANNELS.has(raw as TReservationChannel)
    ? (raw as TReservationChannel)
    : null;
}

function parseReportRentalType(raw: unknown): TReportRentalTypeFilter | null {
  if (typeof raw !== "string") return null;
  return REPORT_RENTAL_TYPES.has(raw as TReportRentalTypeFilter)
    ? (raw as TReportRentalTypeFilter)
    : null;
}

export function parseReportsQuery(
  query: Record<string, unknown>
): { ok: true; query: IPropertyReportsQuery } | { error: string; ok: false } {
  const from = parseDateString(query["from"]);
  const to = parseDateString(query["to"]);
  if (!from) return { error: "from is required and must be a YYYY-MM-DD date", ok: false };
  if (!to) return { error: "to is required and must be a YYYY-MM-DD date", ok: false };
  if (from > to) return { error: "from must be on or before to", ok: false };

  const filters: IPropertyReportsQuery = { from, to };

  if (query["unitId"] !== undefined && query["unitId"] !== "") {
    const unitId = parseOptionalUuid(query["unitId"]);
    if (unitId === null) return { error: "unitId must be a valid UUID", ok: false };
    if (unitId) filters.unitId = unitId;
  }

  if (query["channel"] !== undefined && query["channel"] !== "") {
    const channel = parseReservationChannel(query["channel"]);
    if (channel === null) {
      return {
        error: `channel must be one of: ${[...RESERVATION_CHANNELS].join(", ")}`,
        ok: false,
      };
    }
    filters.channel = channel;
  }

  if (query["rentalType"] !== undefined && query["rentalType"] !== "") {
    const rentalType = parseReportRentalType(query["rentalType"]);
    if (rentalType === null) {
      return {
        error: `rentalType must be one of: ${[...REPORT_RENTAL_TYPES].join(", ")}`,
        ok: false,
      };
    }
    filters.rentalType = rentalType;
  }

  return { ok: true, query: filters };
}
