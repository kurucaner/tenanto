import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { userNotificationsDb } from "@/db/user-notifications";
import { HttpStatus, UserType } from "@/packages/shared";
import { notificationStreamHub } from "@/services/notification-stream-hub";
import { decodeKeysetCursor } from "@/pagination/keyset-cursor";

import {
  parseNotificationListLimit,
  parseUuidParam,
} from "./notification-query-utils";

export interface INotificationsListQuerystring {
  cursor?: string;
  limit?: string;
}

function publishNotificationUpdate(userId: string, log: FastifyRequest["log"]): void {
  notificationStreamHub.publish(userId).catch((err) => {
    log.error(err);
  });
}

export const notificationRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get(
    "/notifications/stream",
    { config: { rateLimit: false }, preHandler: authPre },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.user.userType !== UserType.USER) {
        return reply.status(HttpStatus.FORBIDDEN).send({ error: "Forbidden" });
      }

      const userId = request.user.userId;
      if (notificationStreamHub.getConnectionCount(userId) >= 5) {
        return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({
          error: "Too many notification stream connections",
        });
      }

      const count = await userNotificationsDb.countUnread(userId);
      const registered = notificationStreamHub.register(userId, reply, count);
      if (registered === "too_many") {
        return reply.status(HttpStatus.TOO_MANY_REQUESTS).send({
          error: "Too many notification stream connections",
        });
      }
    }
  );

  server.get(
    "/notifications/unread-count",
    { preHandler: authPre },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const count = await userNotificationsDb.countUnread(request.user.userId);
      return reply.send({ count });
    }
  );

  server.get<{ Querystring: INotificationsListQuerystring }>(
    "/notifications",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Querystring: INotificationsListQuerystring }>,
      reply: FastifyReply
    ) => {
      const qs = request.query;
      const limit = parseNotificationListLimit(qs.limit);

      if (qs.cursor != null && qs.cursor !== "") {
        try {
          decodeKeysetCursor(qs.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const { items, nextCursor } = await userNotificationsDb.listPaginated({
        cursor: qs.cursor,
        limit,
        userId: request.user.userId,
      });

      return reply.send({ items, nextCursor });
    }
  );

  server.patch<{ Params: { id: string } }>(
    "/notifications/:id/read",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const idParsed = parseUuidParam(request.params.id);
      if (idParsed === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid notification id" });
      }

      const item = await userNotificationsDb.markRead(request.user.userId, idParsed);
      if (item == null) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Notification not found" });
      }

      publishNotificationUpdate(request.user.userId, request.log);

      return reply.send({ item });
    }
  );

  server.post(
    "/notifications/read-all",
    { preHandler: authPre },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const updated = await userNotificationsDb.markAllRead(request.user.userId);
      publishNotificationUpdate(request.user.userId, request.log);
      return reply.send({ updated });
    }
  );
};
