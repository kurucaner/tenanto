import crypto from "node:crypto";

import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { HttpStatus, JwtError, UserType } from "@/packages/shared";
import { getBearerTokenRaw, getQueryAccessTokenRaw } from "@/routes/vaults/vault-hls-manifest-url";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

interface JwtUserPayload {
  email: string;
  userId: string;
  userType: UserType;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUserPayload;
    user: JwtUserPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateBearerOrAccessTokenQuery: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const jwtPlugin = async (server: FastifyInstance) => {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  await server.register(fastifyJwt, { secret });

  server.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err: unknown) {
      const code =
        (err as { code?: string })?.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED"
          ? JwtError.TOKEN_EXPIRED
          : JwtError.TOKEN_INVALID;
      reply.status(HttpStatus.UNAUTHORIZED).send({ code, error: "Unauthorized" });
    }
  });

  server.decorate(
    "authenticateBearerOrAccessTokenQuery",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (getBearerTokenRaw(request) != null) {
        try {
          await request.jwtVerify();
        } catch (err: unknown) {
          const code =
            (err as { code?: string })?.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED"
              ? JwtError.TOKEN_EXPIRED
              : JwtError.TOKEN_INVALID;
          await reply.status(HttpStatus.UNAUTHORIZED).send({ code, error: "Unauthorized" });
        }
        return;
      }

      const queryToken = getQueryAccessTokenRaw(request);
      if (queryToken != null) {
        try {
          const decoded = server.jwt.verify<JwtUserPayload>(queryToken);
          request.user = decoded;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const code =
            /expired|EXP/i.test(msg) ||
            (err as { code?: string })?.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED"
              ? JwtError.TOKEN_EXPIRED
              : JwtError.TOKEN_INVALID;
          await reply.status(HttpStatus.UNAUTHORIZED).send({ code, error: "Unauthorized" });
        }
        return;
      }

      await reply
        .status(HttpStatus.UNAUTHORIZED)
        .send({ code: JwtError.TOKEN_INVALID, error: "Unauthorized" });
    }
  );

  server.decorate("requireAdmin", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user.userType !== UserType.ADMIN) {
      return reply.status(HttpStatus.FORBIDDEN).send({ error: "Forbidden" });
    }
  });
};

export const jwtAuthPlugin = fp(jwtPlugin, { name: "jwt-auth" });

export const signAccessToken = (server: FastifyInstance, payload: JwtUserPayload): string => {
  return server.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getRefreshTokenExpiresAt = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return date;
};
