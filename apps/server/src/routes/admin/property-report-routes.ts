import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  buildPropertyReportCsv,
  buildPropertyReportSummary,
  loadReportData,
} from "@/services/property-report-service";

import {
  type IPropertyParams,
  loadPropertyReportContext,
} from "./property-report-route-context";

async function buildSummary(propertyId: string, query: Parameters<typeof loadReportData>[1]) {
  const data = await loadReportData(propertyId, query);
  const summary = buildPropertyReportSummary(data, query);

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
      const context = await loadPropertyReportContext(request, reply);
      if (!context) return;

      const summary = await buildSummary(context.propertyId, context.query);
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
      const context = await loadPropertyReportContext(request, reply);
      if (!context) return;

      const summary = await buildSummary(context.propertyId, context.query);
      const csv = buildPropertyReportCsv(summary);

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="property-${context.propertyId}-report-${context.query.from}-${context.query.to}.csv"`
        )
        .send(csv);
    }
  );
};
