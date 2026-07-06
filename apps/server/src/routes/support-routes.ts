import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { supportMessagesDb } from "@/db/support-messages";
import { supportRequestsDb } from "@/db/support-requests";
import {
  HttpStatus,
  type ISupportCreateBody,
  type ISupportMessageCreateBody,
  type SupportCategory,
  type SupportRequestStatus,
  UserType,
} from "@/packages/shared";
import { decodeKeysetCursor } from "@/pagination/keyset-cursor";
import { postDiscordWebhook } from "@/services/discord-webhook";

import {
  isValidSupportCategory,
  parseOptionalSupportCategory,
  parseOptionalSupportRequestStatus,
  parseSupportListLimit,
  parseSupportMessageBody,
  parseSupportRequestPatchBody,
  parseUuidParam,
} from "./support-query-utils";

export interface ISupportListQuerystring {
  category?: string;
  cursor?: string;
  limit?: string;
  status?: string;
}

async function sendToDiscord(payload: {
  category: string;
  message: string;
  userEmail: string;
}): Promise<void> {
  const categoryLabels: Record<string, string> = {
    bug: "Bug Report",
    feature: "Feature Request",
    general: "General",
  };
  const categoryLabel = categoryLabels[payload.category] ?? "General";

  const body = {
    embeds: [
      {
        color: 0xb8860b,
        fields: [
          { inline: true, name: "Category", value: categoryLabel },
          { inline: true, name: "User", value: payload.userEmail },
          { inline: false, name: "Message", value: payload.message || "No message provided" },
        ],
        timestamp: new Date().toISOString(),
        title: "Support Request",
      },
    ],
  };

  await postDiscordWebhook(process.env["DISCORD_SUPPORT_WEBHOOK_URL"], body);
}

function resolveStatusAfterMessage(params: {
  currentStatus: SupportRequestStatus;
  isAdmin: boolean;
}): SupportRequestStatus | null {
  if (params.isAdmin && params.currentStatus === "pending") {
    return "in_progress";
  }
  if (!params.isAdmin && params.currentStatus === "resolved") {
    return "in_progress";
  }
  return null;
}

function parseListQuery(
  qs: ISupportListQuerystring,
  reply: FastifyReply
): {
  category?: SupportCategory;
  limit: number;
  status?: SupportRequestStatus;
} | null {
  const limit = parseSupportListLimit(qs.limit);
  if (qs.cursor != null && qs.cursor !== "") {
    try {
      decodeKeysetCursor(qs.cursor);
    } catch {
      void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
      return null;
    }
  }

  const statusParsed = parseOptionalSupportRequestStatus(qs.status);
  if (statusParsed === null) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid status filter" });
    return null;
  }
  const categoryParsed = parseOptionalSupportCategory(qs.category);
  if (categoryParsed === null) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid category filter" });
    return null;
  }

  return {
    category: categoryParsed,
    limit,
    status: statusParsed,
  };
}

export const supportRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];
  const adminPre = [server.authenticate, server.requireAdmin];

  server.post<{ Body: ISupportCreateBody }>(
    "/support",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Body: ISupportCreateBody }>, reply: FastifyReply) => {
      const { category, message } = request.body;
      const userId = request.user.userId;
      const userEmail = request.user.email;

      if (!isValidSupportCategory(category)) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: "category must be one of: bug, feature, general",
        });
      }

      const trimmedMessage = typeof message === "string" ? message.trim() : "";
      if (trimmedMessage.length === 0) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "message is required" });
      }
      if (trimmedMessage.length > 2000) {
        return reply.status(HttpStatus.BAD_REQUEST).send({
          error: "message must be at most 2000 characters",
        });
      }

      let detail;
      try {
        detail = await supportRequestsDb.createWithInitialMessage({
          category,
          message: trimmedMessage,
          userId,
        });
      } catch (err) {
        server.log.error(err);
        return reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          error: "Failed to submit support request",
        });
      }

      const webhookUrl = process.env["DISCORD_SUPPORT_WEBHOOK_URL"];
      if (webhookUrl) {
        sendToDiscord({
          category,
          message: trimmedMessage,
          userEmail,
        }).catch((err) => server.log.error(err));
      }

      return reply.status(HttpStatus.OK).send({
        id: detail.item.id,
        item: detail,
        success: true,
      });
    }
  );

  server.get<{ Querystring: ISupportListQuerystring }>(
    "/support",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Querystring: ISupportListQuerystring }>,
      reply: FastifyReply
    ) => {
      const parsed = parseListQuery(request.query, reply);
      if (parsed == null) return;

      if (request.user.userType === UserType.ADMIN) {
        const { items, nextCursor } = await supportRequestsDb.listPaginatedForAdmin({
          category: parsed.category,
          cursor: request.query.cursor,
          limit: parsed.limit,
          status: parsed.status,
        });
        return reply.send({ items, nextCursor });
      }

      const { items, nextCursor } = await supportRequestsDb.listPaginatedForUser({
        category: parsed.category,
        cursor: request.query.cursor,
        limit: parsed.limit,
        status: parsed.status,
        userId: request.user.userId,
      });
      return reply.send({ items, nextCursor });
    }
  );

  server.get<{ Params: { id: string } }>(
    "/support/:id",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const idParsed = parseUuidParam(request.params.id);
      if (idParsed === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid support request id" });
      }

      const detail =
        request.user.userType === UserType.ADMIN
          ? await supportRequestsDb.findDetailByIdForAdmin(idParsed)
          : await supportRequestsDb.findDetailByIdForUser(idParsed, request.user.userId);

      if (detail == null) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Support request not found" });
      }

      return reply.send(detail);
    }
  );

  server.post<{ Body: ISupportMessageCreateBody; Params: { id: string } }>(
    "/support/:id/messages",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Body: ISupportMessageCreateBody; Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const idParsed = parseUuidParam(request.params.id);
      if (idParsed === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid support request id" });
      }

      const parsedBody = parseSupportMessageBody(request.body);
      if (!parsedBody.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsedBody.error });
      }

      const ticket = await supportRequestsDb.findById(idParsed);
      if (ticket == null) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Support request not found" });
      }

      const isAdmin = request.user.userType === UserType.ADMIN;
      if (!isAdmin && ticket.userId !== request.user.userId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Support request not found" });
      }

      await supportMessagesDb.create({
        authorUserId: request.user.userId,
        body: parsedBody.body,
        supportRequestId: idParsed,
      });

      const nextStatus = resolveStatusAfterMessage({
        currentStatus: ticket.status,
        isAdmin,
      });
      if (nextStatus != null) {
        await supportRequestsDb.updateStatus(idParsed, nextStatus);
      }

      const detail =
        isAdmin
          ? await supportRequestsDb.findDetailByIdForAdmin(idParsed)
          : await supportRequestsDb.findDetailByIdForUser(idParsed, request.user.userId);

      if (detail == null) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Support request not found" });
      }

      return reply.send(detail);
    }
  );

  server.patch<{ Params: { id: string } }>(
    "/support/:id",
    { preHandler: adminPre },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const idParsed = parseUuidParam(request.params.id);
      if (idParsed === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid support request id" });
      }

      const parsed = parseSupportRequestPatchBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const item = await supportRequestsDb.updateSettableStatusForAdmin(
        idParsed,
        parsed.body.status
      );
      if (item == null) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Support request not found" });
      }

      return reply.send({ item });
    }
  );
};
