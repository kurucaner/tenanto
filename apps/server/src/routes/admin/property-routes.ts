import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { adminAuditEventsDb } from "@/db/admin-audit-events";
import { pool } from "@/db/pool";
import { propertiesDb } from "@/db/properties";
import { propertyInvitesDb } from "@/db/property-invites";
import { propertyMembersDb } from "@/db/property-members";
import { userDb } from "@/db/users";
import {
  AdminAuditAction,
  HttpStatus,
  type IAdminAddPropertyMemberBody,
  type IAdminCreatePropertyBody,
  type IAdminUpdatePropertyBody,
  type IAdminUpdatePropertyMemberBody,
  PropertyRole,
  type TPropertyRole,
  UserType,
} from "@/packages/shared";
import { decodeKeysetCursor } from "@/pagination/keyset-cursor";
import { sendPropertyInviteEmail } from "@/ses/transactional-emails";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseAddMemberBody(
  raw: unknown
): { body: IAdminAddPropertyMemberBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r["email"] !== "string" || r["email"].trim() === "") {
    return { error: "email is required", ok: false };
  }
  if (!EMAIL_REGEX.test(r["email"].trim())) {
    return { error: "email is not valid", ok: false };
  }
  const role = parsePropertyRole(r["role"]);
  if (role === null) {
    return { error: `role must be one of: ${[...PROPERTY_ROLES].join(", ")}`, ok: false };
  }
  return { body: { email: r["email"].trim().toLowerCase(), role }, ok: true };
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

async function assertPropertyAccess(
  propertyId: string,
  userId: string,
  userType: string,
  reply: FastifyReply
): Promise<ReturnType<typeof propertiesDb.findById> extends Promise<infer T> ? T : never> {
  const property = await propertiesDb.findById(propertyId);
  if (!property) {
    void reply.status(HttpStatus.NOT_FOUND).send({ error: "Property not found" });
    return null as never;
  }
  if (userType === UserType.ADMIN) {
    return property as never;
  }
  const isCreator = property.createdBy === userId;
  if (!isCreator) {
    const membership = await propertyMembersDb.findOne(propertyId, userId);
    if (!membership) {
      void reply.status(HttpStatus.FORBIDDEN).send({ error: "Access denied" });
      return null as never;
    }
  }
  return property as never;
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
  const authPre = [server.authenticate];

  server.get<{ Querystring: IPropertiesListQuerystring }>(
    "/properties",
    { preHandler: authPre },
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

      const q = typeof qs.q === "string" && qs.q.trim() !== "" ? qs.q.trim() : undefined;
      const isAdmin = request.user.userType === UserType.ADMIN;
      const { items, nextCursor } = isAdmin
        ? await propertiesDb.listPaginatedForAdmin({ cursor: qs.cursor, limit, q })
        : await propertiesDb.listPaginatedForUser({
            cursor: qs.cursor,
            limit,
            q,
            userId: request.user.userId,
          });

      return reply.send({ items, nextCursor });
    }
  );

  server.post(
    "/properties",
    { preHandler: authPre },
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
    "/properties/:propertyId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const access = await assertPropertyAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!access) return;

      const property = await propertiesDb.findDetailById(propertyId);
      return reply.send({ property });
    }
  );

  server.patch<{ Params: IPropertyParams }>(
    "/properties/:propertyId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const existing = await assertPropertyAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!existing) return;

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
    "/properties/:propertyId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const existing = await assertPropertyAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!existing) return;

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
    "/properties/:propertyId/members",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const propertyExists = await assertPropertyAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!propertyExists) return;

      const parsed = parseAddMemberBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const { email, role } = parsed.body;
      const targetUser = await userDb.findByEmail(email);

      if (targetUser) {
        const existingMember = await propertyMembersDb.findOne(propertyId, targetUser.id);
        if (existingMember) {
          return reply
            .status(HttpStatus.CONFLICT)
            .send({ error: "User is already a member of this property" });
        }
        const member = await propertyMembersDb.add(
          propertyId,
          targetUser.id,
          role,
          request.user.userId
        );
        return reply.status(HttpStatus.CREATED).send({ member, type: "member_added" });
      }

      // User does not exist — create invite
      const existingInvite = await propertyInvitesDb.findByPropertyAndEmail(propertyId, email);
      if (existingInvite && existingInvite.status === "pending") {
        return reply
          .status(HttpStatus.CONFLICT)
          .send({ error: "An invitation has already been sent to this email" });
      }

      const currentUser = await userDb.findById(request.user.userId);
      const invite = await propertyInvitesDb.create({
        email,
        invitedBy: request.user.userId,
        propertyId,
        role,
      });

      try {
        await sendPropertyInviteEmail(email, {
          inviterName: currentUser?.name ?? "Someone",
          propertyName: propertyExists.name,
          role,
        });
        return reply.status(HttpStatus.CREATED).send({ invite, type: "invite_sent" });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown email error";
        await propertyInvitesDb.updateStatus(invite.id, "email_failed", errMsg);
        const failed = { ...invite, emailError: errMsg, status: "email_failed" as const };
        return reply.status(HttpStatus.CREATED).send({ invite: failed, type: "invite_email_failed" });
      }
    }
  );

  server.patch<{ Params: IPropertyMemberParams }>(
    "/properties/:propertyId/members/:userId",
    { preHandler: authPre },
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

      const propertyAccess = await assertPropertyAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!propertyAccess) return;

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
    "/properties/:propertyId/members/:userId",
    { preHandler: authPre },
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

      const propertyAccess = await assertPropertyAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!propertyAccess) return;

      const removed = await propertyMembersDb.remove(propertyId, userId);
      if (!removed) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Member not found" });
      }

      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
