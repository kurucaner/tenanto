import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { isAllowedRumPath } from "../lib/intake-origin";

const SENSITIVE_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
]);

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

async function forwardRumRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  intakeOrigin: string
): Promise<void> {
  const pathname = request.url.split("?")[0] ?? "/";
  const search = request.url.includes("?") ? `?${request.url.split("?")[1]}` : "";
  const queryParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const subdomain = queryParams.get("ddforwardSubdomain");

  if (!isAllowedRumPath(pathname)) {
    return reply.code(400).send({ error: "Invalid Datadog intake path" });
  }

  const targetUrl = buildTargetUrl(intakeOrigin, pathname, search, subdomain);
  const clientIp = getClientIp(request);
  const body = request.body;

  if (body === undefined || body === null) {
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
    handler: async (request, reply) => forwardRumRequest(request, reply, intakeOrigin),
    method: ["POST"],
    url: "/*",
  });
}
