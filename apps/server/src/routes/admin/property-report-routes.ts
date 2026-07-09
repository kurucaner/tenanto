import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { HttpStatus, type IPropertyReportsQuery } from "@/packages/shared";
import {
  buildPropertyReportCsv,
  buildPropertyReportSummary,
  loadReportData,
} from "@/services/property-report-service";
import { WinstonLogger } from "@/services/winston";

import { parseUuidParam } from "./admin-query-utils";
import { assertPropertyMemberAccess } from "./property-route-access";
import { parseReportsQuery } from "./report-query";

interface IPropertyParams {
  propertyId: string;
}

async function buildSummary(propertyId: string, query: IPropertyReportsQuery) {
  const data = await loadReportData(propertyId, query);
  const summary = buildPropertyReportSummary(data, query);

  WinstonLogger.info("[TAX_DEBUG_v1] buildSummary", {
    hasTaxSummaryKey: "taxSummary" in summary,
    propertyId,
    query,
    summaryKeys: Object.keys(summary),
    taxSummary: summary.taxSummary,
  });

  return summary;
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
