import type { FastifyRequest } from "fastify";

import { isProduction } from "@/lib/environment";

export function getInternalSecretFromRequest(request: FastifyRequest): string | null {
  const headerSecret = request.headers["x-internal-secret"];
  if (typeof headerSecret === "string" && headerSecret.length > 0) {
    return headerSecret;
  }

  const authorization = request.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
  }

  return null;
}

export function isAuthorizedInternalRequest(request: FastifyRequest): boolean {
  const configuredSecret = process.env.AWS_INTERNAL_SECRET;
  if (configuredSecret == null || configuredSecret === "") {
    return !isProduction;
  }

  const providedSecret = getInternalSecretFromRequest(request);
  return providedSecret != null && providedSecret === configuredSecret;
}
