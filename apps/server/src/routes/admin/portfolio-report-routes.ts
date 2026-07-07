import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertiesDb } from "@/db/properties";
import { HttpStatus, UserType } from "@/packages/shared";
import {
  buildPortfolioReportCsv,
  buildPortfolioReportSummary,
} from "@/services/property-report-service";

import { parseReportsQuery } from "./report-query";

export const portfolioReportRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Querystring: Record<string, unknown> }>(
    "/reports/summary",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply
    ) => {
      const parsed = parseReportsQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const isAdmin = request.user.userType === UserType.ADMIN;
      const properties = await propertiesDb.listAccessibleForUser(request.user.userId, isAdmin);
      const summary = await buildPortfolioReportSummary(properties, parsed.query);
      return reply.send({ summary });
    }
  );

  server.get<{ Querystring: Record<string, unknown> }>(
    "/reports/export",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply
    ) => {
      const parsed = parseReportsQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const isAdmin = request.user.userType === UserType.ADMIN;
      const properties = await propertiesDb.listAccessibleForUser(request.user.userId, isAdmin);
      const summary = await buildPortfolioReportSummary(properties, parsed.query);
      const csv = buildPortfolioReportCsv(summary);

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="portfolio-report-${parsed.query.from}-${parsed.query.to}.csv"`
        )
        .send(csv);
    }
  );
};
