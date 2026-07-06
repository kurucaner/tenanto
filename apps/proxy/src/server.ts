import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { resolveIntakeOrigin } from "./lib/intake-origin";
import { registerRumProxyRoutes } from "./routes/rum-proxy";

const DEFAULT_PORT = 8082;
const DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3002"];

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return DEFAULT_CORS_ORIGINS;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function start(): Promise<void> {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const ddSite = process.env.DD_SITE ?? "us5.datadoghq.com";
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  const intakeOrigin = resolveIntakeOrigin(ddSite);

  const fastify = Fastify({
    logger: process.env.NODE_ENV === "production",
    trustProxy: true,
  });

  fastify.addContentTypeParser(
    "*",
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    }
  );

  await fastify.register(cors, {
    allowedHeaders: ["Content-Type"],
    methods: ["POST", "OPTIONS"],
    origin: corsOrigins,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  fastify.get("/health", async () => ({ ok: true, service: "datadog-rum-proxy" }));

  await registerRumProxyRoutes(fastify, intakeOrigin);

  await fastify.listen({ host: "0.0.0.0", port });

  fastify.log.info(
    { corsOrigins, ddSite, intakeOrigin, port },
    "Datadog RUM proxy listening"
  );
}

start().catch((error: unknown) => {
  console.error("Failed to start Datadog RUM proxy:", error);
  process.exit(1);
});
