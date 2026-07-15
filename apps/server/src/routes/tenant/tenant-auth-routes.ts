import type { FastifyInstance, FastifyReply } from "fastify";

import { TENANT_AUTH_RATE_LIMIT_WINDOW_MS } from "@/lib/tenant-portal-rate-limit-config";
import {
  HttpStatus,
  type ITenantAppleAuthBody,
  type ITenantGoogleAuthBody,
  type ITenantPhoneAuthStartBody,
  type ITenantPhoneAuthVerifyBody,
  type ITenantPhoneBindStartBody,
  type ITenantPhoneBindVerifyBody,
  type TPlatform,
} from "@/packages/shared";
import { tenantEmailPasswordAuthRealm } from "@/services/auth-realms/tenant-email-auth-realm";
import {
  assertTenantAuthAttemptAllowed,
  getTenantAuthRateLimitErrorMessage,
} from "@/services/tenant-auth-rate-limit";
import {
  startTenantPhoneBind,
  startTenantPhoneLogin,
  type TTenantPhoneAuthResult,
  verifyTenantPhoneBind,
  verifyTenantPhoneLogin,
} from "@/services/tenant-phone-auth-service";
import {
  authenticateTenantWithApple,
  authenticateTenantWithGoogle,
} from "@/services/tenant-social-auth-service";

import { registerEmailPasswordAuthRoutes } from "../auth/register-email-password-auth-routes";

async function sendPhoneAuthResult(
  reply: FastifyReply,
  result: TTenantPhoneAuthResult
): Promise<void> {
  if (result.status === "error") {
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        reply.header(key, value);
      }
    }
    await reply.status(result.statusCode).send(result.body);
    return;
  }

  if (result.session) {
    await reply.send(result.session);
    return;
  }
  if (result.user) {
    await reply.send({ user: result.user });
    return;
  }
  await reply.send({ ok: true });
}

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

  const tenantAuthPre = { preHandler: server.authenticateTenant.bind(server) };

  server.post<{ Body: ITenantPhoneAuthStartBody }>(
    "/tenant/auth/phone/start",
    async (request, reply) => {
      const result = await startTenantPhoneLogin({
        body: request.body ?? { phone: "" },
        ip: request.ip,
      });
      return sendPhoneAuthResult(reply, result);
    }
  );

  server.post<{ Body: ITenantPhoneAuthVerifyBody }>(
    "/tenant/auth/phone/verify",
    async (request, reply) => {
      const result = await verifyTenantPhoneLogin(server, {
        body: request.body ?? { code: "", phone: "" },
        ip: request.ip,
      });
      return sendPhoneAuthResult(reply, result);
    }
  );

  server.post<{ Body: ITenantPhoneBindStartBody }>(
    "/tenant/auth/phone/bind/start",
    tenantAuthPre,
    async (request, reply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }
      const result = await startTenantPhoneBind({
        body: request.body ?? { phone: "" },
        ip: request.ip,
        tenantUserId,
      });
      return sendPhoneAuthResult(reply, result);
    }
  );

  server.post<{ Body: ITenantPhoneBindVerifyBody }>(
    "/tenant/auth/phone/bind/verify",
    tenantAuthPre,
    async (request, reply) => {
      const tenantUserId = request.tenantUser?.tenantUserId;
      if (!tenantUserId) {
        return reply.status(HttpStatus.UNAUTHORIZED).send({ error: "Unauthorized" });
      }
      const result = await verifyTenantPhoneBind({
        body: request.body ?? { code: "", phone: "" },
        ip: request.ip,
        tenantUserId,
      });
      return sendPhoneAuthResult(reply, result);
    }
  );
};
