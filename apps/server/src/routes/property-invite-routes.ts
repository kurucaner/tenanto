import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { userDb } from "@/db/users";
import { HttpStatus, type IPropertyInviteRedeemBody } from "@/packages/shared";
import { parseUuidParam } from "@/routes/admin/admin-query-utils";
import { parseJsonObject } from "@/routes/admin/parse-body-utils";
import {
  propertyMemberInviteActionService,
  PropertyMemberInviteInvalidStateError,
  PropertyMemberInviteNotFoundError,
} from "@/services/property-member-invite-action-service";
import { propertyMemberInviteService } from "@/services/property-member-invite-service";

function parseRedeemBody(body: unknown): IPropertyInviteRedeemBody | null {
  const parsed = parseJsonObject(body);
  if (!parsed) return null;
  const token = parsed.token;
  if (typeof token !== "string" || token.trim() === "") {
    return null;
  }
  return { token: token.trim() };
}

function mapInviteActionError(error: unknown, reply: FastifyReply): FastifyReply | null {
  if (error instanceof PropertyMemberInviteNotFoundError) {
    return reply.status(HttpStatus.NOT_FOUND).send({ error: error.message });
  }
  if (error instanceof PropertyMemberInviteInvalidStateError) {
    return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
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
