import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { HttpStatus } from "@/packages/shared";
import type { IEmailPasswordAuthRealm } from "@/services/auth-realms/email-password-auth-realm";
import {
  handleEmailLogin,
  handleLogout,
  handleRefresh,
  handleRegisterStart,
  handleRegisterVerify,
} from "@/services/email-password-auth-handlers";

export interface IEmailPasswordAuthRoutePaths {
  loginPath: string;
  logoutPath: string;
  refreshPath: string;
  registerStartPath: string;
  registerVerifyPath: string;
}

export type TAuthRouteRateLimitAction = "login" | "register_start";

export interface IRegisterEmailPasswordAuthRoutesOptions {
  /**
   * Optional tighter auth rate limit (e.g. tenant portal). When set, applied to
   * register/start and login before handler logic.
   */
  checkAuthRateLimit?: (input: {
    action: TAuthRouteRateLimitAction;
    email: string;
    ip: string;
  }) => Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }>;
  getAuthRateLimitErrorMessage?: (input: { retryAfterSec: number }) => string;
  requireNameAndPasswordOnRegisterStart?: boolean;
}

function readBodyEmail(body: unknown): string {
  if (body == null || typeof body !== "object") {
    return "";
  }
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? email : "";
}

async function enforceAuthRateLimit(
  options: IRegisterEmailPasswordAuthRoutesOptions | undefined,
  action: TAuthRouteRateLimitAction,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  if (!options?.checkAuthRateLimit) {
    return true;
  }

  const rateLimit = await options.checkAuthRateLimit({
    action,
    email: readBodyEmail(request.body),
    ip: request.ip,
  });
  if (rateLimit.allowed) {
    return true;
  }

  const error =
    options.getAuthRateLimitErrorMessage?.({ retryAfterSec: rateLimit.retryAfterSec }) ??
    "Too many authentication attempts. Try again later.";

  reply
    .status(HttpStatus.TOO_MANY_REQUESTS)
    .header("Retry-After", String(rateLimit.retryAfterSec))
    .send({ error });
  return false;
}

export function registerEmailPasswordAuthRoutes<TUser, TSession>(
  server: FastifyInstance,
  paths: IEmailPasswordAuthRoutePaths,
  realm: IEmailPasswordAuthRealm<TUser, TSession>,
  options?: IRegisterEmailPasswordAuthRoutesOptions
): void {
  server.post<{ Body: { email: string; name?: string; password?: string } }>(
    paths.registerStartPath,
    async (request, reply) => {
      const allowed = await enforceAuthRateLimit(options, "register_start", request, reply);
      if (!allowed) {
        return;
      }
      return handleRegisterStart(realm, request.body, reply, {
        requireNameAndPassword: options?.requireNameAndPasswordOnRegisterStart,
      });
    }
  );

  server.post<{ Body: { email: string; name: string; otp: string; password: string } }>(
    paths.registerVerifyPath,
    async (request, reply) => handleRegisterVerify(realm, server, request.body, reply)
  );

  server.post<{ Body: { email: string; password: string } }>(
    paths.loginPath,
    async (request, reply) => {
      const allowed = await enforceAuthRateLimit(options, "login", request, reply);
      if (!allowed) {
        return;
      }
      return handleEmailLogin(realm, server, request.body, reply);
    }
  );

  server.post<{ Body: { refreshToken: string } }>(paths.refreshPath, async (request, reply) =>
    handleRefresh(realm, server, request.body, reply)
  );

  server.post<{ Body: { refreshToken: string } }>(paths.logoutPath, async (request, reply) => {
    const pushTokenHeader = request.headers["x-push-token"];
    const pushToken = typeof pushTokenHeader === "string" ? pushTokenHeader.trim() : undefined;
    return handleLogout(realm, request.body, reply, { pushToken });
  });
}
