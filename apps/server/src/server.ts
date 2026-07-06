import "dotenv/config";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { jwtAuthPlugin } from "./auth/jwt";
import { initializeDatabase } from "./db/pool";
import { isProduction } from "./environment";
import { resolveAllowedOrigin } from "./lib/cors-headers";
import { adminRoutes } from "./routes/admin/admin-routes";
import { homeRoutes } from "./routes/admin/home-routes";
import { portfolioReportRoutes } from "./routes/admin/portfolio-report-routes";
import { propertyExpenseRoutes } from "./routes/admin/property-expense-routes";
import { propertyIncomeLineRoutes } from "./routes/admin/property-income-line-routes";
import { propertyReportRoutes } from "./routes/admin/property-report-routes";
import { propertyReservationRoutes } from "./routes/admin/property-reservation-routes";
import { propertyRoutes } from "./routes/admin/property-routes";
import { propertySettingsRoutes } from "./routes/admin/property-settings-routes";
import { propertyUnitRoutes } from "./routes/admin/property-unit-routes";
import { authRoutes } from "./routes/auth/auth-routes";
import { initRoutes } from "./routes/init-routes";
import { notificationRoutes } from "./routes/notification-routes";
import { pushTokenRoutes } from "./routes/push-token-routes";
import { supportRoutes } from "./routes/support-routes";
import { unsubscribeRoutes } from "./routes/unsubscribe-routes";
import { startRefreshTokenCleanupCron } from "./scheduler/refresh-token-cleanup-cron";
import { getLogMessage, sanitizeForLog } from "./services/log-helpers";
import { notificationStreamHub } from "./services/notification-stream-hub";
import { createFastifyLogAdapter, normalizeWinstonRecord, WinstonLogger } from "./services/winston";

const pm2Instance = process.env["NODE_APP_INSTANCE"];

export const server = Fastify({ logger: false });
server.log = createFastifyLogAdapter();

server.register(cors, {
  allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-Stream-Client-Id"],
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin: (origin, callback) => {
    const allowed = resolveAllowedOrigin(origin);
    if (allowed == null) {
      callback(new Error("Not allowed by CORS"), false);
      return;
    }
    callback(null, allowed === "*" ? true : allowed);
  },
});
server.register(helmet);
server.register(rateLimit, {
  allowList: (request) => request.url.split("?")[0] === "/notifications/stream",
  max: isProduction ? 20 : 100,
  timeWindow: "1 minute",
});
server.register(jwtAuthPlugin);
server.register(initRoutes);
server.register(authRoutes);
server.register(adminRoutes);
server.register(propertyRoutes);
server.register(propertyUnitRoutes);
server.register(propertySettingsRoutes);
server.register(propertyReservationRoutes);
server.register(propertyIncomeLineRoutes);
server.register(propertyExpenseRoutes);
server.register(propertyReportRoutes);
server.register(portfolioReportRoutes);
server.register(homeRoutes);
server.register(pushTokenRoutes);
server.register(supportRoutes);
server.register(notificationRoutes);
server.register(unsubscribeRoutes);

server.register(async (server) => {
  server.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
});

server.addHook("preSerialization", async (_request, reply, payload) => {
  (reply as { logPayload?: unknown }).logPayload = payload;

  return payload;
});

server.addHook("onResponse", async (request, reply) => {
  if (request.method === "GET" && request.url.split("?")[0] === "/health") {
    return;
  }

  const userId = request.user?.userId;
  const logPayload = (reply as { logPayload?: unknown }).logPayload;

  WinstonLogger.info(
    normalizeWinstonRecord({
      ip: request.ip,
      method: request.method,
      msg: getLogMessage(request, reply.statusCode),
      reqBody: sanitizeForLog(request.body),
      resBody: sanitizeForLog(logPayload),
      responseTimeMs: reply.elapsedTime,
      statusCode: reply.statusCode,
      url: request.url,
      userId,
    })
  );
});

server.addHook("onError", async (request, reply, error) => {
  const statusCode =
    reply.statusCode ?? (typeof error.statusCode === "number" ? error.statusCode : 500);
  WinstonLogger.error(
    normalizeWinstonRecord({
      errMessage: error.message,
      ip: request.ip,
      method: request.method,
      msg: getLogMessage(request, statusCode),
      stack: error.stack,
      url: request.url,
      userId: request.user?.userId,
    })
  );
});

const start = async () => {
  try {
    const ok = await initializeDatabase();
    if (!ok) {
      WinstonLogger.error("Failed to connect to database");
      process.exit(1);
    }

    if (pm2Instance === undefined || pm2Instance === "0") {
      startRefreshTokenCleanupCron();
    }

    await notificationStreamHub.start();

    const port = Number(process.env["PORT"]);
    await server.listen({ host: "0.0.0.0", port });
  } catch (err) {
    WinstonLogger.error(err instanceof Error ? err : new Error(String(err)));
    process.exit(1);
  }
};

start();

process.on("SIGINT", () => {
  WinstonLogger.info("SIGINT signal received. Shutting down gracefully...");
  void notificationStreamHub.stop().finally(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});

process.on("SIGTERM", () => {
  WinstonLogger.info("SIGTERM signal received. Shutting down gracefully...");
  void notificationStreamHub.stop().finally(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
