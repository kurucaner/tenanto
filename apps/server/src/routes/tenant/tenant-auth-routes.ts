import type { FastifyInstance } from "fastify";

import { tenantEmailPasswordAuthRealm } from "@/services/auth-realms/tenant-email-auth-realm";

import { registerEmailPasswordAuthRoutes } from "../auth/register-email-password-auth-routes";

export const tenantAuthRoutes = async (server: FastifyInstance): Promise<void> => {
  registerEmailPasswordAuthRoutes(
    server,
    {
      loginPath: "/tenant/auth/login",
      logoutPath: "/tenant/auth/logout",
      refreshPath: "/tenant/auth/refresh",
      registerStartPath: "/tenant/auth/register/start",
      registerVerifyPath: "/tenant/auth/register/verify",
    },
    tenantEmailPasswordAuthRealm
  );
};
