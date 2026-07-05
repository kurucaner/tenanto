import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { adminAuditEventsDb } from "@/db/admin-audit-events";
import { pool } from "@/db/pool";
import { propertiesDb } from "@/db/properties";
import { propertyMembersDb } from "@/db/property-members";
import { userDb } from "@/db/users";
import {
  AdminAuditAction,
  type IAdminAddPropertyMemberBody,
  type IAdminCreatePropertyBody,
  type IAdminUpdatePropertyBody,
  type IAdminUpdatePropertyMemberBody,
  HttpStatus,
  PropertyRole,
  type TPropertyRole,
} from "@/packages/shared";
import { decodeKeysetCursor } from "@/pagination/keyset-cursor";

import { parseAdminLimit, parseUuidParam } from "./admin-query-utils";
import { buildInsertAdminAuditParams } from "./record-admin-audit";

const PROPERTY_ROLES = new Set<TPropertyRole>(Object.values(PropertyRole));

function parsePropertyRole(raw: unknown): TPropertyRole | null {
  if (typeof raw !== "string") return null;
  return PROPERTY_ROLES.has(raw as TPropertyRole) ? (raw as TPropertyRole) : null;
}

function parseCreatePropertyBody(
  raw: unknown
): { body: IAdminCreatePropertyBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r["name"] !== "string" || r["name"].trim() === "") {
    return { error: "name is required", ok: false };
  }
  if (typeof r["address"] !== "string" || r["address"].trim() === "") {
    return { error: "address is required", ok: false };
  }
  const phoneNumber =
    typeof r["phoneNumber"] === "string" && r["phoneNumber"].trim() !== ""
      ? r["phoneNumber"].trim()
      : undefined;
  return { body: { address: r["address"], name: r["name"], phoneNumber }, ok: true };
}

function parseUpdatePropertyBody(
  raw: unknown
): { body: IAdminUpdatePropertyBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  const body: IAdminUpdatePropertyBody = {};

  if ("name" in r) {
    if (typeof r["name"] !== "string" || r["name"].trim() === "") {
      return { error: "name must be a non-empty string", ok: false };
    }
    body.name = r["name"];
  }
  if ("address" in r) {
    if (typeof r["address"] !== "string" || r["address"].trim() === "") {
      return { error: "address must be a non-empty string", ok: false };
    }
    body.address = r["address"];
  }
  if ("phoneNumber" in r) {
    const rawPhone = r["phoneNumber"];
    if (rawPhone == null || rawPhone === "") {
      body.phoneNumber = null;
    } else {
      body.phoneNumber = typeof rawPhone === "string" ? rawPhone : null;
    }
  }
  return { body, ok: true };
}

function parseAddMemberBody(
  raw: unknown
): { body: IAdminAddPropertyMemberBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r["userId"] !== "string" || r["userId"].trim() === "") {
    return { error: "userId is required", ok: false };
  }
  const role = parsePropertyRole(r["role"]);
  if (role === null) {
    return { error: `role must be one of: ${[...PROPERTY_ROLES].join(", ")}`, ok: false };
  }
  return { body: { role, userId: r["userId"] }, ok: true };
}

function parseUpdateMemberBody(
  raw: unknown
): { body: IAdminUpdatePropertyMemberBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  const role = parsePropertyRole(r["role"]);
  if (role === null) {
    return { error: `role must be one of: ${[...PROPERTY_ROLES].join(", ")}`, ok: false };
  }
  return { body: { role }, ok: true };
}

interface IPropertiesListQuerystring {
  cursor?: string;
  limit?: string;
  q?: string;
}

interface IPropertyParams {
  propertyId: string;
}

interface IPropertyMemberParams {
  propertyId: string;
  userId: string;
}

export const propertyRoutes = async (server: FastifyInstance): Promise<void> => {
  const adminPre = [server.authenticate, server.requireAdmin];

  server.get<{ Querystring: IPropertiesListQuerystring }>(
    "/admin/properties",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Querystring: IPropertiesListQuerystring }>,
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

      const { items, nextCursor } = await propertiesDb.listPaginatedForAdmin({
        cursor: qs.cursor,
        limit,
        q: typeof qs.q === "string" && qs.q.trim() !== "" ? qs.q.trim() : undefined,
      });

      return reply.send({ items, nextCursor });
    }
  );

  server.post(
    "/admin/properties",
    { preHandler: adminPre },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = parseCreatePropertyBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const property = await propertiesDb.create(parsed.body, request.user.userId);
        await adminAuditEventsDb.insert(
          client,
          buildInsertAdminAuditParams(request, {
            action: AdminAuditAction.PROPERTY_CREATED,
            metadata: { name: property.name },
            resourceId: property.id,
            resourceType: "property",
          })
        );
        await client.query("COMMIT");
        return reply.status(HttpStatus.CREATED).send({ property });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );

  server.get<{ Params: IPropertyParams }>(
    "/admin/properties/:propertyId",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const property = await propertiesDb.findDetailById(propertyId);
      if (!property) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
      }

      return reply.send({ property });
    }
  );

  server.patch<{ Params: IPropertyParams }>(
    "/admin/properties/:propertyId",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const existing = await propertiesDb.findById(propertyId);
      if (!existing) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
      }

      const parsed = parseUpdatePropertyBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const updated = await propertiesDb.update(propertyId, parsed.body);
        await adminAuditEventsDb.insert(
          client,
          buildInsertAdminAuditParams(request, {
            action: AdminAuditAction.PROPERTY_UPDATED,
            metadata: { patch: parsed.body },
            resourceId: propertyId,
            resourceType: "property",
          })
        );
        await client.query("COMMIT");
        return reply.send({ property: updated });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );

  server.delete<{ Params: IPropertyParams }>(
    "/admin/properties/:propertyId",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const existing = await propertiesDb.findById(propertyId);
      if (!existing) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await propertiesDb.delete(propertyId);
        await adminAuditEventsDb.insert(
          client,
          buildInsertAdminAuditParams(request, {
            action: AdminAuditAction.PROPERTY_DELETED,
            metadata: { name: existing.name },
            resourceId: propertyId,
            resourceType: "property",
          })
        );
        await client.query("COMMIT");
        return reply.status(HttpStatus.NO_CONTENT).send();
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );

  server.post<{ Params: IPropertyParams }>(
    "/admin/properties/:propertyId/members",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const propertyExists = await propertiesDb.findById(propertyId);
      if (!propertyExists) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
      }

      const parsed = parseAddMemberBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const targetUser = await userDb.findById(parsed.body.userId);
      if (!targetUser) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "User not found" });
      }

      const existingMember = await propertyMembersDb.findOne(propertyId, parsed.body.userId);
      if (existingMember) {
        return reply
          .status(HttpStatus.CONFLICT)
          .send({ error: "User is already a member of this property" });
      }

      const member = await propertyMembersDb.add(
        propertyId,
        parsed.body.userId,
        parsed.body.role,
        request.user.userId
      );

      return reply.status(HttpStatus.CREATED).send({ member });
    }
  );

  server.patch<{ Params: IPropertyMemberParams }>(
    "/admin/properties/:propertyId/members/:userId",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Params: IPropertyMemberParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const userId = parseUuidParam(request.params.userId);
      if (userId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid userId" });
      }

      const existing = await propertyMembersDb.findOne(propertyId, userId);
      if (!existing) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Member not found" });
      }

      const parsed = parseUpdateMemberBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const updated = await propertyMembersDb.updateRole(propertyId, userId, parsed.body.role);
      return reply.send({ member: updated });
    }
  );

  server.delete<{ Params: IPropertyMemberParams }>(
    "/admin/properties/:propertyId/members/:userId",
    { preHandler: adminPre },
    async (
      request: FastifyRequest<{ Params: IPropertyMemberParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const userId = parseUuidParam(request.params.userId);
      if (userId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid userId" });
      }

      const removed = await propertyMembersDb.remove(propertyId, userId);
      if (!removed) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Member not found" });
      }

      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
