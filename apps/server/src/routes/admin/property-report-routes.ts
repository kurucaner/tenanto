import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  HttpStatus,
  type IPropertyReportsQuery,
  ReportRentalTypeFilter,
  ReservationChannel,
  type TReportRentalTypeFilter,
  type TReservationChannel,
} from "@/packages/shared";
import {
  buildPropertyReportCsv,
  buildPropertyReportSummary,
  loadReportData,
} from "@/services/property-report-service";

import { parseOptionalUuid, parseUuidParam } from "./admin-query-utils";
import { assertPropertyMemberAccess } from "./property-route-access";

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

function parseReportsQuery(
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

interface IPropertyParams {
  propertyId: string;
}

async function buildSummary(propertyId: string, query: IPropertyReportsQuery) {
  const data = await loadReportData(propertyId, query);
  return buildPropertyReportSummary(data, query);
}

export const propertyReportRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/reports/summary",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const parsed = parseReportsQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const summary = await buildSummary(propertyId, parsed.query);
      return reply.send({ summary });
    }
  );

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/reports/export",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const parsed = parseReportsQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const summary = await buildSummary(propertyId, parsed.query);
      const csv = buildPropertyReportCsv(summary);

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="property-${propertyId}-report-${parsed.query.from}-${parsed.query.to}.csv"`
        )
        .send(csv);
    }
  );
};
