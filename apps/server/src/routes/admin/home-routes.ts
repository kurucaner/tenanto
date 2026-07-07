import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertiesDb } from "@/db/properties";
import {
  type IHomeFinancialOverview,
  type IPropertyReportTotals,
  UserType,
} from "@/packages/shared";
import { buildPortfolioReportSummary } from "@/services/property-report-service";

const EMPTY_TOTALS: IPropertyReportTotals = {
  grossIncome: 0,
  netIncome: 0,
  operationalNet: 0,
  totalExpenses: 0,
};

function getHomeFinancialDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export const homeRoutes = async (server: FastifyInstance): Promise<void> => {
  server.get(
    "/home/financial-overview",
    { preHandler: [server.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const isAdmin = request.user.userType === UserType.ADMIN;
      const properties = await propertiesDb.listAccessibleForUser(request.user.userId, isAdmin);
      const period = getHomeFinancialDateRange();

      if (properties.length === 0) {
        const overview: IHomeFinancialOverview = {
          byMonth: [],
          expenseByCategory: [],
          period,
          propertyCount: 0,
          totals: EMPTY_TOTALS,
        };
        return reply.send({ overview });
      }

      const summary = await buildPortfolioReportSummary(properties, period);
      const overview: IHomeFinancialOverview = {
        byMonth: summary.totals.byMonth,
        expenseByCategory: summary.totals.expenseByCategory.slice(0, 6),
        period,
        propertyCount: properties.length,
        totals: summary.totals.totals,
      };

      return reply.send({ overview });
    }
  );
};
