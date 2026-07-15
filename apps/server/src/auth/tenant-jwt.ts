import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { HttpStatus, JwtAudience, JwtError } from "@/packages/shared";

import { type JwtUserPayload, type TenantJwtPayload } from "./jwt";

export type { TenantJwtPayload };

const TENANT_ACCESS_TOKEN_EXPIRY = "15m";

declare module "fastify" {
  interface FastifyInstance {
    authenticateTenant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    tenantUser?: TenantJwtPayload;
  }
}

const tenantJwtPlugin = async (server: FastifyInstance) => {
  server.decorate("authenticateTenant", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = (await request.jwtVerify()) as TenantJwtPayload;
      if (payload.aud !== JwtAudience.TENANT || !payload.tenantUserId) {
        reply.status(HttpStatus.UNAUTHORIZED).send({
          code: JwtError.TOKEN_INVALID,
          error: "Unauthorized",
        });
        return;
      }
      request.tenantUser = payload;
    } catch (err: unknown) {
      const code =
        (err as { code?: string })?.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED"
          ? JwtError.TOKEN_EXPIRED
          : JwtError.TOKEN_INVALID;
      reply.status(HttpStatus.UNAUTHORIZED).send({ code, error: "Unauthorized" });
    }
  });
};

export const tenantJwtAuthPlugin = fp(tenantJwtPlugin, {
  dependencies: ["jwt-auth"],
  name: "tenant-jwt-auth",
});

export type SignTenantAccessTokenInput = Omit<TenantJwtPayload, "aud">;

export const signTenantAccessToken = (
  server: FastifyInstance,
  payload: SignTenantAccessTokenInput
): string => {
  return server.jwt.sign({ ...payload, aud: JwtAudience.TENANT } as unknown as JwtUserPayload, {
    expiresIn: TENANT_ACCESS_TOKEN_EXPIRY,
  });
};
