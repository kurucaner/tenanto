import type { FastifyInstance } from "fastify";

import { TENANT_AUTH_RATE_LIMIT_WINDOW_MS } from "@/lib/tenant-portal-rate-limit-config";
import {
  type ITenantAppleAuthBody,
  type ITenantGoogleAuthBody,
  type TPlatform,
} from "@/packages/shared";
import { tenantEmailPasswordAuthRealm } from "@/services/auth-realms/tenant-email-auth-realm";
import {
  assertTenantAuthAttemptAllowed,
  getTenantAuthRateLimitErrorMessage,
} from "@/services/tenant-auth-rate-limit";
import {
  authenticateTenantWithApple,
  authenticateTenantWithGoogle,
} from "@/services/tenant-social-auth-service";

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

  server.post<{ Body: ITenantGoogleAuthBody }>("/tenant/auth/google", async (request, reply) => {
    const result = await authenticateTenantWithGoogle(server, {
      body: request.body ?? { idToken: "" },
      ip: request.ip,
      platform: request.headers["x-platform"] as TPlatform,
    });

    if (result.status === "error") {
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          reply.header(key, value);
        }
      }
      return reply.status(result.statusCode).send(result.body);
    }

    return reply.send(result.session);
  });

  server.post<{ Body: ITenantAppleAuthBody }>("/tenant/auth/apple", async (request, reply) => {
    const result = await authenticateTenantWithApple(server, {
      body: request.body ?? { identityToken: "" },
      ip: request.ip,
    });

    if (result.status === "error") {
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          reply.header(key, value);
        }
      }
      return reply.status(result.statusCode).send(result.body);
    }

    return reply.send(result.session);
  });
};
