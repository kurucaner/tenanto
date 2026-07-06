import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { adminAuditEventsDb } from "@/db/admin-audit-events";
import { appConfigDb } from "@/db/app-config";
import { pool } from "@/db/pool";
import { pushTokenDb } from "@/db/push-tokens";
import { userDb } from "@/db/users";
import {
  AdminAuditAction,
  HttpStatus,
  type IAppConfig,
  UserType,
} from "@/packages/shared";
import { decodeKeysetCursor } from "@/pagination/keyset-cursor";

import {
  parseAdminLimit,
  parseIncludeDeleted,
  parseOptionalUuid,
  parseUserTypeFilter,
} from "./admin-query-utils";
import {
  type IAuditEventsListQuerystring,
  type IUsersListQuerystring,
} from "./admin-types";
import { parsePatchAppConfigBody } from "./parse-patch-app-config-body";
import { buildInsertAdminAuditParams } from "./record-admin-audit";

function appConfigSnapshot(config: IAppConfig) {
  return {
    appStoreUrl: config.appStoreUrl,
    maintenanceMode: config.maintenanceMode,
    minAndroidAppVersion: config.minAndroidAppVersion,
    minIosAppVersion: config.minIosAppVersion,
    playStoreUrl: config.playStoreUrl,
  };
}

export const adminRoutes = async (server: FastifyInstance): Promise<void> => {
  const adminPre = [server.authenticate, server.requireAdmin];

  server.get("/admin/stats", { preHandler: adminPre }, async (_request, reply) => {
    const userStats = await userDb.getAdminPlatformUserStats();
    return reply.send({
      usersTotal: userStats.usersTotal,
    });
  });

  server.get<{ Querystring: IAuditEventsListQuerystring }>(
    "/admin/audit-events",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Querystring: IAuditEventsListQuerystring }>,
      reply: FastifyReply
    ) => {
      const qs = request.query;
      const limit = parseAdminLimit(qs.limit);

      if (qs.cursor != null && qs.cursor !== "") {
        try {
          decodeKeysetCursor(qs.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const resourceId = parseOptionalUuid(qs.resource_id);
      if (resourceId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid resource_id" });
      }

      const actorUserId = parseOptionalUuid(qs.actor_user_id);
      if (actorUserId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid actor_user_id" });
      }

      const resourceType =
        typeof qs.resource_type === "string" && qs.resource_type.trim() !== ""
          ? qs.resource_type.trim().slice(0, 64)
          : undefined;

      const { events, nextCursor } = await adminAuditEventsDb.listPaginatedFromPool({
        actor_user_id: actorUserId,
        cursor: typeof qs.cursor === "string" && qs.cursor !== "" ? qs.cursor : undefined,
        limit,
        resource_id: resourceId,
        resource_type: resourceType,
      });

      return reply.send({ events, nextCursor });
    }
  );

  server.get<{ Params: { user_id: string } }>(
    "/admin/users/:user_id/audit-events",
    { preHandler: adminPre },
    async (request: FastifyRequest<{ Params: { user_id: string } }>, reply: FastifyReply) => {
      const { user_id: userId } = request.params;
      const uuid = parseOptionalUuid(userId);
      if (uuid === null || uuid === undefined) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid user_id" });
      }

      const qs = request.query as IAuditEventsListQuerystring;
      const limit = parseAdminLimit(qs.limit);

      if (qs.cursor != null && qs.cursor !== "") {
        try {
          decodeKeysetCursor(qs.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const { events, nextCursor } = await adminAuditEventsDb.listPaginatedFromPool({
        cursor: typeof qs.cursor === "string" && qs.cursor !== "" ? qs.cursor : undefined,
        limit,
        resource_id: uuid,
        resource_type: "user",
      });

      return reply.send({ events, nextCursor });
    }
  );

  server.get<{ Querystring: IUsersListQuerystring }>(
    "/admin/users",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Querystring: IUsersListQuerystring }>,
      reply: FastifyReply
    ) => {
      const qs = request.query;
      const limit = parseAdminLimit(qs.limit);
      const includeDeleted = parseIncludeDeleted(qs.include_deleted);

      let cursor: { createdAt: string; id: string } | null = null;
      if (qs.cursor != null && qs.cursor !== "") {
        try {
          cursor = decodeKeysetCursor(qs.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const userType = parseUserTypeFilter(qs.user_type);
      if (qs.user_type != null && qs.user_type !== "" && userType === undefined) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid user_type" });
      }

      const { nextCursor, users } = await userDb.listUsersPaginated({
        cursor,
        includeDeleted,
        limit,
        q: typeof qs.q === "string" ? qs.q : undefined,
        userType,
      });

      return reply.send({ nextCursor, users });
    }
  );

  server.get<{ Params: { user_id: string } }>(
    "/admin/users/:user_id",
    { preHandler: adminPre },
    async (request: FastifyRequest<{ Params: { user_id: string } }>, reply: FastifyReply) => {
      const { user_id: userId } = request.params;
      const detail = await userDb.findByIdForAdmin(userId);
      if (!detail) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
      }

      const activePushTokens = await pushTokenDb.countActiveByUserId(userId);

      return reply.send({
        stats: { activePushTokens },
        user: {
          ...detail.user,
          deletedAt: detail.deletedAt,
          hasPassword: detail.hasPassword,
          isDeleted: detail.isDeleted,
        },
      });
    }
  );

  server.post<{ Params: { user_id: string } }>(
    "/admin/users/:user_id/reset-account",
    { preHandler: adminPre },
    async (request: FastifyRequest<{ Params: { user_id: string } }>, reply: FastifyReply) => {
      const { user_id: rawUserId } = request.params;
      const targetUserId = parseOptionalUuid(rawUserId);
      if (targetUserId === null || targetUserId === undefined) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid user_id" });
      }

      const target = await userDb.findByIdForAdmin(targetUserId);
      if (!target) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
      }

      if (target.user.userType === UserType.ADMIN) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Cannot reset admin accounts" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await adminAuditEventsDb.insert(
          client,
          buildInsertAdminAuditParams(request, {
            action: AdminAuditAction.USER_ACCOUNT_RESET,
            metadata: { targetEmail: target.user.email },
            resourceId: targetUserId,
            resourceType: "user",
          })
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      const detailAfter = await userDb.findByIdForAdmin(targetUserId);
      if (!detailAfter) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
      }
      const activePushTokens = await pushTokenDb.countActiveByUserId(targetUserId);

      return reply.send({
        stats: { activePushTokens },
        user: {
          ...detailAfter.user,
          deletedAt: detailAfter.deletedAt,
          hasPassword: detailAfter.hasPassword,
          isDeleted: detailAfter.isDeleted,
        },
      });
    }
  );

  server.get("/admin/app-config", { preHandler: adminPre }, async (_request, reply) => {
    const config = await appConfigDb.find();
    if (!config) {
      return reply.status(HttpStatus.NOT_FOUND).send({ error: "App config not found" });
    }
    return reply.send({ config });
  });

  server.patch(
    "/admin/app-config",
    { preHandler: adminPre },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = parsePatchAppConfigBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }
      const { patch } = parsed;

      const beforeConfig = await appConfigDb.find();
      if (!beforeConfig) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "App config not found" });
      }
      const before = appConfigSnapshot(beforeConfig);

      const client = await pool.connect();
      let updated: IAppConfig | null;
      try {
        await client.query("BEGIN");
        updated = await appConfigDb.updateWithClient(client, patch);
        if (!updated) {
          await client.query("ROLLBACK");
          return reply.status(HttpStatus.NOT_FOUND).send({ error: "App config not found" });
        }
        await adminAuditEventsDb.insert(
          client,
          buildInsertAdminAuditParams(request, {
            action: AdminAuditAction.APP_CONFIG_UPDATED,
            metadata: {
              after: appConfigSnapshot(updated),
              before,
              configId: updated.id,
            },
            resourceId: null,
            resourceType: "app_config",
          })
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      return reply.send({ config: updated });
    }
  );
};
