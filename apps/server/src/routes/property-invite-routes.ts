import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { userDb } from "@/db/users";
import {
  HttpStatus,
  type IPropertyInviteRedeemBody,
  type IPropertyInviteRegisterBody,
  type IPropertyInviteRegisterGoogleBody,
  type TPlatform,
} from "@/packages/shared";
import { parseUuidParam } from "@/routes/admin/admin-query-utils";
import { parseJsonObject } from "@/routes/admin/parse-body-utils";
import { replyFromDomainError } from "@/routes/reply-from-domain-error";
import { propertyMemberInviteActionService } from "@/services/property-member-invite-action-service";
import { propertyMemberInviteService } from "@/services/property-member-invite-service";
import {
  registerPlatformUserWithInviteGoogle,
  registerPlatformUserWithInvitePassword,
  type TPropertyMemberInviteSignupResult,
} from "@/services/property-member-invite-signup-service";

function parseRedeemBody(body: unknown): IPropertyInviteRedeemBody | null {
  const parsed = parseJsonObject(body);
  if (!parsed) return null;
  const token = parsed.token;
  if (typeof token !== "string" || token.trim() === "") {
    return null;
  }
  return { token: token.trim() };
}

function parseInviteRegisterBody(body: unknown): IPropertyInviteRegisterBody | null {
  if (body == null || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const token = record.token;
  const name = record.name;
  const password = record.password;
  if (typeof token !== "string" || token.trim() === "") {
    return null;
  }
  if (typeof name !== "string" || typeof password !== "string") {
    return null;
  }
  return { name, password, token: token.trim() };
}

function parseInviteRegisterGoogleBody(body: unknown): IPropertyInviteRegisterGoogleBody | null {
  if (body == null || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  const token = record.token;
  const idToken = record.idToken;
  if (typeof token !== "string" || token.trim() === "") {
    return null;
  }
  if (typeof idToken !== "string" || idToken.trim() === "") {
    return null;
  }
  return { idToken: idToken.trim(), token: token.trim() };
}

async function sendInviteSignupResult(
  reply: FastifyReply,
  result: TPropertyMemberInviteSignupResult
): Promise<FastifyReply> {
  if (result.status === "error") {
    return reply.status(result.statusCode).send(result.body);
  }
  return reply.send(result.response);
}

function mapInviteActionError(error: unknown, reply: FastifyReply): FastifyReply | null {
  if (replyFromDomainError(reply, error)) {
    return reply;
  }
  return null;
}

export const propertyInviteRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Querystring: { token?: string } }>(
    "/invites/preview",
    async (request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
      const token = request.query.token?.trim();
      if (!token) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "token is required" });
      }

      try {
        const preview = await propertyMemberInviteService.previewInvite(token);
        return reply.send(preview);
      } catch (error) {
        const mapped = mapInviteActionError(error, reply);
        if (mapped) return mapped;
        throw error;
      }
    }
  );

  server.post("/invites/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseInviteRegisterBody(request.body);
    if (!body) {
      return reply
        .status(HttpStatus.BAD_REQUEST)
        .send({ error: "token, name, and password are required" });
    }

    const result = await registerPlatformUserWithInvitePassword(server, {
      body,
      ip: request.ip,
    });
    return sendInviteSignupResult(reply, result);
  });

  server.post("/invites/register/google", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseInviteRegisterGoogleBody(request.body);
    if (!body) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "token and idToken are required" });
    }

    const result = await registerPlatformUserWithInviteGoogle(server, {
      body,
      ip: request.ip,
      platform: request.headers["x-platform"] as TPlatform,
    });
    return sendInviteSignupResult(reply, result);
  });

  server.post("/invites/redeem", { preHandler: authPre }, async (request, reply) => {
    const body = parseRedeemBody(request.body);
    if (!body) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: "token is required" });
    }

    const user = await userDb.findById(request.user.userId);
    if (!user) {
      return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
    }

    try {
      const result = await propertyMemberInviteActionService.redeemInvite(body.token, user);
      return reply.send(result);
    } catch (error) {
      const mapped = mapInviteActionError(error, reply);
      if (mapped) return mapped;
      throw error;
    }
  });

  server.get("/me/invites/pending", { preHandler: authPre }, async (request, reply) => {
    const user = await userDb.findById(request.user.userId);
    if (!user) {
      return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
    }

    const invites = await propertyMemberInviteActionService.listPendingInvites(user);
    return reply.send({ invites });
  });

  server.post<{ Params: { inviteId: string } }>(
    "/me/invites/:inviteId/accept",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: { inviteId: string } }>, reply: FastifyReply) => {
      const inviteId = parseUuidParam(request.params.inviteId);
      if (inviteId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid inviteId" });
      }

      const user = await userDb.findById(request.user.userId);
      if (!user) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
      }

      try {
        const result = await propertyMemberInviteActionService.acceptInvite(inviteId, user);
        return reply.send(result);
      } catch (error) {
        const mapped = mapInviteActionError(error, reply);
        if (mapped) return mapped;
        throw error;
      }
    }
  );

  server.post<{ Params: { inviteId: string } }>(
    "/me/invites/:inviteId/decline",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: { inviteId: string } }>, reply: FastifyReply) => {
      const inviteId = parseUuidParam(request.params.inviteId);
      if (inviteId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid inviteId" });
      }

      const user = await userDb.findById(request.user.userId);
      if (!user) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
      }

      try {
        const invite = await propertyMemberInviteActionService.declineInvite(inviteId, user);
        return reply.send({ invite });
      } catch (error) {
        const mapped = mapInviteActionError(error, reply);
        if (mapped) return mapped;
        throw error;
      }
    }
  );
};
