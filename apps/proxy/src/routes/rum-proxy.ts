import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { isAllowedRumPath } from "../lib/intake-origin";
import { parseIngestTarget, type IngestTarget } from "../lib/parse-ingest-target";

const SENSITIVE_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
]);

function getBodyByteLength(body: unknown): number {
  if (body instanceof Buffer) {
    return body.length;
  }
  if (body instanceof ArrayBuffer) {
    return body.byteLength;
  }
  return 0;
}

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? request.ip;
  }
  return request.ip;
}

function resolveIntakeOriginWithSubdomain(
  intakeOrigin: string,
  subdomain: string | null
): string {
  if (!subdomain) {
    return intakeOrigin;
  }

  const url = new URL(intakeOrigin);
  url.hostname = `${subdomain}.${url.hostname}`;
  return url.origin;
}

function buildTargetUrl(
  intakeOrigin: string,
  pathname: string,
  search: string,
  subdomain: string | null
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("ddforwardSubdomain");
  const origin = resolveIntakeOriginWithSubdomain(intakeOrigin, subdomain);
  const query = params.toString();
  return query.length > 0 ? `${origin}${pathname}?${query}` : `${origin}${pathname}`;
}

function getRequestSearch(request: FastifyRequest): string {
  return request.url.includes("?") ? `?${request.url.split("?")[1]}` : "";
}

function getLegacyTarget(request: FastifyRequest): IngestTarget {
  return {
    pathname: request.url.split("?")[0] ?? "/",
    search: getRequestSearch(request),
  };
}

async function forwardRumRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  intakeOrigin: string,
  target: IngestTarget
): Promise<void> {
  const { pathname, search } = target;
  const queryParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const subdomain = queryParams.get("ddforwardSubdomain");
  const clientIp = getClientIp(request);
  const body = request.body;

  console.log("[proxy] incoming", {
    bodyBytes: getBodyByteLength(body),
    ip: clientIp,
    method: request.method,
    origin: request.headers.origin,
    path: pathname,
  });

  if (!isAllowedRumPath(pathname)) {
    console.log("[proxy] rejected invalid path", pathname);
    return reply.code(400).send({ error: "Invalid Datadog intake path" });
  }

  const targetUrl = buildTargetUrl(intakeOrigin, pathname, search, subdomain);

  if (body === undefined || body === null) {
    console.log("[proxy] rejected missing body", pathname);
    return reply.code(400).send({ error: "Missing request body" });
  }

  const forwardHeaders = new Headers();
  const contentType = request.headers["content-type"];
  if (typeof contentType === "string") {
    forwardHeaders.set("Content-Type", contentType);
  }
  forwardHeaders.set("X-Forwarded-For", clientIp);

  const upstream = await fetch(targetUrl, {
    body: body instanceof Buffer ? body : Buffer.from(body as ArrayBuffer),
    headers: forwardHeaders,
    method: "POST",
  });

  console.log("[proxy] forwarded", {
    path: pathname,
    targetHost: new URL(targetUrl).hostname,
    upstreamStatus: upstream.status,
  });

  const responseBody = Buffer.from(await upstream.arrayBuffer());
  reply.code(upstream.status);

  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    reply.header("Content-Type", upstreamContentType);
  }

  return reply.send(responseBody);
}

export async function registerRumProxyRoutes(
  fastify: FastifyInstance,
  intakeOrigin: string
): Promise<void> {
  fastify.addHook("onRequest", async (request, _reply) => {
    const pathname = request.url.split("?")[0] ?? "/";
    console.log("[proxy] request", request.method, pathname);

    if (request.method === "OPTIONS") {
      return;
    }

    for (const header of SENSITIVE_REQUEST_HEADERS) {
      if (request.headers[header] !== undefined) {
        delete request.headers[header];
      }
    }
  });

  fastify.route({
    handler: async (request, reply) => {
      const search = getRequestSearch(request);
      const queryParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      const target = parseIngestTarget(queryParams.get("t"));

      if (!target) {
        console.log("[proxy] rejected invalid ingest target");
        return reply.code(400).send({ error: "Invalid ingest target" });
      }

      return forwardRumRequest(request, reply, intakeOrigin, target);
    },
    method: ["POST"],
    url: "/ingest",
  });

  fastify.route({
    handler: async (request, reply) =>
      forwardRumRequest(request, reply, intakeOrigin, getLegacyTarget(request)),
    method: ["POST"],
    url: "/*",
  });
}
