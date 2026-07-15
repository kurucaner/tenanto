import type { FastifyInstance } from "fastify";

import { TENANT_AUTH_RATE_LIMIT_WINDOW_MS } from "@/lib/tenant-portal-rate-limit-config";
import { tenantEmailPasswordAuthRealm } from "@/services/auth-realms/tenant-email-auth-realm";
import {
  assertTenantAuthAttemptAllowed,
  getTenantAuthRateLimitErrorMessage,
} from "@/services/tenant-auth-rate-limit";

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
    tenantEmailPasswordAuthRealm,
    {
      checkAuthRateLimit: assertTenantAuthAttemptAllowed,
      getAuthRateLimitErrorMessage: ({ retryAfterSec }) =>
        getTenantAuthRateLimitErrorMessage({
          retryAfterSec,
          windowMs: TENANT_AUTH_RATE_LIMIT_WINDOW_MS,
        }),
    }
  );
};
