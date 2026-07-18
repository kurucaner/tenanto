import "dotenv/config";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import {
  EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_FILES,
} from "@/packages/shared";

import { jwtAuthPlugin } from "./auth/jwt";
import { tenantJwtAuthPlugin } from "./auth/tenant-jwt";
import { initializeDatabase } from "./db/pool";
import { resolveAllowedOrigin } from "./lib/cors-headers";
import { isProduction } from "./lib/environment";
import { adminRoutes } from "./routes/admin/admin-routes";
import { homeRoutes } from "./routes/admin/home-routes";
import { portfolioReportRoutes } from "./routes/admin/portfolio-report-routes";
import { propertyExpenseImportRoutes } from "./routes/admin/property-expense-import-routes";
import { propertyExpenseRoutes } from "./routes/admin/property-expense-routes";
import { propertyExportRoutes } from "./routes/admin/property-export-routes";
import { propertyIncomeEntriesRoutes } from "./routes/admin/property-income-entries-routes";
import { propertyIncomeImportRoutes } from "./routes/admin/property-income-import-routes";
import { propertyIncomeLineRoutes } from "./routes/admin/property-income-line-routes";
import { propertyLongStayPortalRoutes } from "./routes/admin/property-long-stay-portal-routes";
import { propertyLongStayRoutes } from "./routes/admin/property-long-stay-routes";
import { propertyReportRoutes } from "./routes/admin/property-report-routes";
import { propertyReservationRoutes } from "./routes/admin/property-reservation-routes";
import { propertyRoutes } from "./routes/admin/property-routes";
import { propertySecondaryOccupantRoutes } from "./routes/admin/property-secondary-occupant-routes";
import { propertySettingsRoutes } from "./routes/admin/property-settings-routes";
import { propertyStripeConnectRoutes } from "./routes/admin/property-stripe-connect-routes";
import { propertyTenantEmailCampaignRoutes } from "./routes/admin/property-tenant-email-campaign-routes";
import { propertyUnitRoutes } from "./routes/admin/property-unit-routes";
import { authRoutes } from "./routes/auth/auth-routes";
import { initRoutes } from "./routes/init-routes";
import { notificationRoutes } from "./routes/notification-routes";
import { propertyInviteRoutes } from "./routes/property-invite-routes";
import { pushTokenRoutes } from "./routes/push-token-routes";
import { s3Routes } from "./routes/s3-routes";
import { smsInboundWebhookRoutes } from "./routes/sms-inbound-webhook-routes";
import { stripeWebhookRoutes } from "./routes/stripe-webhook-routes";
import { supportRoutes } from "./routes/support-routes";
import { tenantAuthRoutes } from "./routes/tenant/tenant-auth-routes";
import { tenantLeaseRoutes } from "./routes/tenant/tenant-lease-routes";
import { tenantRentPaymentRoutes } from "./routes/tenant/tenant-rent-payment-routes";
import { tenantSettingsRoutes } from "./routes/tenant/tenant-settings-routes";
import { unsubscribeRoutes } from "./routes/unsubscribe-routes";
import { startPortalInviteExpiryCron } from "./scheduler/portal-invite-expiry-cron";
import { startPropertyExportExpiryCron } from "./scheduler/property-export-expiry-cron";
import { startPropertyMemberInviteExpiryCron } from "./scheduler/property-member-invite-expiry-cron";
import { startRefreshTokenCleanupCron } from "./scheduler/refresh-token-cleanup-cron";
import { startTenantRentPaymentReconcileCron } from "./scheduler/tenant-rent-payment-reconcile-cron";
import { getLogMessage, sanitizeForLog } from "./services/log-helpers";
import { notificationStreamHub } from "./services/notification-stream-hub";
import { createFastifyLogAdapter, normalizeWinstonRecord, WinstonLogger } from "./services/winston";

const pm2Instance = process.env["NODE_APP_INSTANCE"];

export const server = Fastify({ logger: false });
server.log = createFastifyLogAdapter();

server.register(cors, {
  allowedHeaders: [
    "Accept",
    "Authorization",
    "Content-Type",
    "Idempotency-Key",
    "X-Stream-Client-Id",
  ],
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin: (origin, callback) => {
    if (origin == null || origin === "") {
      callback(null, true); // server-to-server: Lambda, webhooks, curl
      return;
    }
    const allowed = resolveAllowedOrigin(origin);
    if (allowed == null) {
      callback(new Error("Not allowed by CORS"), false);
      return;
    }
    callback(null, allowed === "*" ? true : allowed);
  },
});
server.register(helmet);
server.register(multipart, {
  limits: {
    files: EXPENSE_CSV_IMPORT_MAX_FILES,
    fileSize: EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  },
});
server.register(rateLimit, {
  allowList: (request) => {
    const path = request.url.split("?")[0];
    return (
      path === "/notifications/stream" ||
      path === "/s3-notification" ||
      path === "/webhooks/sms/inbound" ||
      path === "/webhooks/stripe"
    );
  },
  max: isProduction ? 20 : 100,
  timeWindow: "1 minute",
});
server.register(jwtAuthPlugin);
server.register(tenantJwtAuthPlugin);
server.register(initRoutes);
server.register(authRoutes);
server.register(propertyInviteRoutes);
server.register(tenantAuthRoutes);
server.register(tenantLeaseRoutes);
server.register(tenantSettingsRoutes);
server.register(tenantRentPaymentRoutes);
server.register(adminRoutes);
server.register(propertyRoutes);
server.register(propertyUnitRoutes);
server.register(propertySettingsRoutes);
server.register(propertyStripeConnectRoutes);
server.register(propertyReservationRoutes);
server.register(propertyIncomeLineRoutes);
server.register(propertyIncomeEntriesRoutes);
server.register(propertyLongStayRoutes);
server.register(propertySecondaryOccupantRoutes);
server.register(propertyLongStayPortalRoutes);
server.register(propertyTenantEmailCampaignRoutes);
server.register(propertyExpenseRoutes);
server.register(propertyExportRoutes);
server.register(propertyExpenseImportRoutes);
server.register(propertyIncomeImportRoutes);
server.register(propertyReportRoutes);
server.register(portfolioReportRoutes);
server.register(homeRoutes);
server.register(pushTokenRoutes);
server.register(s3Routes);
server.register(smsInboundWebhookRoutes);
server.register(stripeWebhookRoutes);
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
      startPropertyExportExpiryCron();
      startPortalInviteExpiryCron();
      startPropertyMemberInviteExpiryCron();
      startTenantRentPaymentReconcileCron();
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
