import {
  type IPropertyReportsQuery,
  ReportRentalTypeFilter,
  ReservationChannel,
  type TReportRentalTypeFilter,
  type TReservationChannel,
} from "@/packages/shared";

import { parseDateString, parseOptionalQueryUuid } from "./admin-query-utils";

const REPORT_RENTAL_TYPES = new Set<TReportRentalTypeFilter>(Object.values(ReportRentalTypeFilter));
const RESERVATION_CHANNELS = new Set<TReservationChannel>(Object.values(ReservationChannel));

function parseReservationChannel(raw: unknown): TReservationChannel | null {
  if (typeof raw !== "string") return null;
  return RESERVATION_CHANNELS.has(raw as TReservationChannel) ? (raw as TReservationChannel) : null;
}

function parseReportRentalType(raw: unknown): TReportRentalTypeFilter | null {
  if (typeof raw !== "string") return null;
  return REPORT_RENTAL_TYPES.has(raw as TReportRentalTypeFilter)
    ? (raw as TReportRentalTypeFilter)
    : null;
}

function parseOptionalReportChannel(
  query: Record<string, unknown>
): { error: string; ok: false } | { ok: true; value?: TReservationChannel } {
  const raw = query["channel"];
  if (raw === undefined || raw === "") return { ok: true };
  const channel = parseReservationChannel(raw);
  if (channel === null) {
    return {
      error: `channel must be one of: ${[...RESERVATION_CHANNELS].join(", ")}`,
      ok: false,
    };
  }
  return { ok: true, value: channel };
}

function parseOptionalReportRentalType(
  query: Record<string, unknown>
): { error: string; ok: false } | { ok: true; value?: TReportRentalTypeFilter } {
  const raw = query["rentalType"];
  if (raw === undefined || raw === "") return { ok: true };
  const rentalType = parseReportRentalType(raw);
  if (rentalType === null) {
    return {
      error: `rentalType must be one of: ${[...REPORT_RENTAL_TYPES].join(", ")}`,
      ok: false,
    };
  }
  return { ok: true, value: rentalType };
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

  const unitIdResult = parseOptionalQueryUuid(query, "unitId", "unitId must be a valid UUID");
  if (!unitIdResult.ok) return unitIdResult;
  if (unitIdResult.value) filters.unitId = unitIdResult.value;

  const channelResult = parseOptionalReportChannel(query);
  if (!channelResult.ok) return channelResult;
  if (channelResult.value) filters.channel = channelResult.value;

  const rentalTypeResult = parseOptionalReportRentalType(query);
  if (!rentalTypeResult.ok) return rentalTypeResult;
  if (rentalTypeResult.value) filters.rentalType = rentalTypeResult.value;

  return { ok: true, query: filters };
}
