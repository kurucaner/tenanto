import type { FastifyInstance } from "fastify";

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

export interface IRegisterEmailPasswordAuthRoutesOptions {
  requireNameAndPasswordOnRegisterStart?: boolean;
}

export function registerEmailPasswordAuthRoutes<TUser, TSession>(
  server: FastifyInstance,
  paths: IEmailPasswordAuthRoutePaths,
  realm: IEmailPasswordAuthRealm<TUser, TSession>,
  options?: IRegisterEmailPasswordAuthRoutesOptions
): void {
  server.post<{ Body: { email: string; name?: string; password?: string } }>(
    paths.registerStartPath,
    async (request, reply) =>
      handleRegisterStart(realm, request.body, reply, {
        requireNameAndPassword: options?.requireNameAndPasswordOnRegisterStart,
      })
  );

  server.post<{ Body: { email: string; name: string; otp: string; password: string } }>(
    paths.registerVerifyPath,
    async (request, reply) => handleRegisterVerify(realm, server, request.body, reply)
  );

  server.post<{ Body: { email: string; password: string } }>(
    paths.loginPath,
    async (request, reply) => handleEmailLogin(realm, server, request.body, reply)
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
