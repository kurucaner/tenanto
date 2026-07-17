import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { adminAuditEventsDb } from "@/db/admin-audit-events";
import { pool } from "@/db/pool";
import { propertiesDb } from "@/db/properties";
import { propertyMembersDb } from "@/db/property-members";
import { propertyUserFavoritesDb } from "@/db/property-user-favorites";
import { userDb } from "@/db/users";
import {
  AdminAuditAction,
  HttpStatus,
  type IAdminAddPropertyMemberBody,
  type IAdminCreatePropertyBody,
  type IAdminSetPropertyFavoriteBody,
  type IAdminUpdatePropertyBody,
  type IAdminUpdatePropertyMemberBody,
  PropertyRole,
  type TPropertyRole,
  UserType,
} from "@/packages/shared";
import { decodePropertyFavoriteKeysetCursor } from "@/pagination/keyset-cursor";
import {
  DuplicatePropertyMemberInviteError,
  PropertyMemberInviteInvalidStateError,
  PropertyMemberInviteMismatchError,
  PropertyMemberInviteNotFoundError,
  propertyMemberInviteService,
} from "@/services/property-member-invite-service";
import { notifyUser } from "@/services/user-notifications";

import { parseAdminLimit, parseUuidParam } from "./admin-query-utils";
import { parseJsonObject } from "./parse-body-utils";
import { parseNullablePhoneNumber, parseOptionalPhoneNumber } from "./phone-body-utils";
import { assertPropertyStructureAccess } from "./property-route-access";
import { buildInsertAdminAuditParams } from "./record-admin-audit";

const PROPERTY_ROLES = new Set<TPropertyRole>(Object.values(PropertyRole));

function parsePropertyRole(raw: unknown): TPropertyRole | null {
  if (typeof raw !== "string") return null;
  return PROPERTY_ROLES.has(raw as TPropertyRole) ? (raw as TPropertyRole) : null;
}

const PROPERTY_LEGAL_NAME_MAX_LENGTH = 255;

function parseOptionalLegalName(
  raw: unknown
): { error: string; ok: false } | { legalName: string | undefined; ok: true } {
  if (raw == null || raw === "") {
    return { legalName: undefined, ok: true };
  }
  if (typeof raw !== "string") {
    return { error: "legalName must be a string", ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { legalName: undefined, ok: true };
  }
  if (trimmed.length > PROPERTY_LEGAL_NAME_MAX_LENGTH) {
    return { error: "legalName must be at most 255 characters", ok: false };
  }
  return { legalName: trimmed, ok: true };
}

function parseNullableLegalName(
  raw: unknown
): { error: string; ok: false } | { legalName: string | null; ok: true } {
  if (raw == null || raw === "") {
    return { legalName: null, ok: true };
  }
  if (typeof raw !== "string") {
    return { error: "legalName must be a string or null", ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { legalName: null, ok: true };
  }
  if (trimmed.length > PROPERTY_LEGAL_NAME_MAX_LENGTH) {
    return { error: "legalName must be at most 255 characters", ok: false };
  }
  return { legalName: trimmed, ok: true };
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
  const phoneResult = parseOptionalPhoneNumber(r["phoneNumber"]);
  if (!phoneResult.ok) {
    return { error: phoneResult.error, ok: false };
  }
  const legalNameResult = parseOptionalLegalName(r["legalName"]);
  if (!legalNameResult.ok) {
    return { error: legalNameResult.error, ok: false };
  }
  return {
    body: {
      address: r["address"],
      legalName: legalNameResult.legalName,
      name: r["name"],
      phoneNumber: phoneResult.phoneNumber,
    },
    ok: true,
  };
}

function parseUpdatePropertyBody(
  raw: unknown
): { body: IAdminUpdatePropertyBody; ok: true } | { error: string; ok: false } {
  const r = parseJsonObject(raw);
  if (!r) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const body: IAdminUpdatePropertyBody = {};
  const nameError = applyUpdatePropertyName(r, body);
  if (nameError) return { error: nameError, ok: false };

  const addressError = applyUpdatePropertyAddress(r, body);
  if (addressError) return { error: addressError, ok: false };

  if ("phoneNumber" in r) {
    const phoneResult = parseNullablePhoneNumber(r["phoneNumber"]);
    if (!phoneResult.ok) {
      return { error: phoneResult.error, ok: false };
    }
    body.phoneNumber = phoneResult.phoneNumber;
  }

  if ("legalName" in r) {
    const legalNameResult = parseNullableLegalName(r["legalName"]);
    if (!legalNameResult.ok) {
      return { error: legalNameResult.error, ok: false };
    }
    body.legalName = legalNameResult.legalName;
  }

  return { body, ok: true };
}

function applyUpdatePropertyName(
  r: Record<string, unknown>,
  body: IAdminUpdatePropertyBody
): string | null {
  if (!("name" in r)) return null;
  if (typeof r["name"] !== "string" || r["name"].trim() === "") {
    return "name must be a non-empty string";
  }
  body.name = r["name"];
  return null;
}

function applyUpdatePropertyAddress(
  r: Record<string, unknown>,
  body: IAdminUpdatePropertyBody
): string | null {
  if (!("address" in r)) return null;
  if (typeof r["address"] !== "string" || r["address"].trim() === "") {
    return "address must be a non-empty string";
  }
  body.address = r["address"];
  return null;
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

function parseSetPropertyFavoriteBody(
  raw: unknown
): { body: IAdminSetPropertyFavoriteBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const favorite = (raw as Record<string, unknown>)["favorite"];
  if (typeof favorite !== "boolean") {
    return { error: "favorite must be a boolean", ok: false };
  }
  return { body: { favorite }, ok: true };
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

type TPropertyRecord = NonNullable<Awaited<ReturnType<typeof propertiesDb.findById>>>;

async function addExistingPropertyMember(
  request: FastifyRequest,
  reply: FastifyReply,
  property: TPropertyRecord,
  propertyId: string,
  targetUser: NonNullable<Awaited<ReturnType<typeof userDb.findByEmail>>>,
  role: TPropertyRole
) {
  if (targetUser.id === property.createdBy) {
    return reply.status(HttpStatus.CONFLICT).send({
      error: "The property creator is already assigned as owner",
    });
  }

  const existingMember = await propertyMembersDb.findOne(propertyId, targetUser.id);
  if (existingMember) {
    return reply
      .status(HttpStatus.CONFLICT)
      .send({ error: "User is already a member of this property" });
  }

  const member = await propertyMembersDb.add(propertyId, targetUser.id, role, request.user.userId);
  notifyUser({
    body: `You were added as ${role}.`,
    resourceId: propertyId,
    resourceType: "property",
    title: `Added to ${property.name}`,
    type: "property_member_added",
    userId: targetUser.id,
  }).catch((err) => request.log.error(err));

  return reply.status(HttpStatus.CREATED).send({ member, type: "member_added" });
}

async function sendPropertyMemberInvite(
  request: FastifyRequest,
  reply: FastifyReply,
  propertyId: string,
  email: string,
  role: TPropertyRole
) {
  try {
    const result = await propertyMemberInviteService.createInvite({
      email,
      invitedBy: request.user.userId,
      propertyId,
      role,
    });

    if (!result.emailSent) {
      return reply.status(HttpStatus.CREATED).send({
        invite: result.invite,
        type: "invite_email_failed",
      });
    }

    return reply.status(HttpStatus.CREATED).send({ invite: result.invite, type: "invite_sent" });
  } catch (error) {
    if (error instanceof DuplicatePropertyMemberInviteError) {
      return reply
        .status(HttpStatus.CONFLICT)
        .send({ error: "An invitation has already been sent to this email" });
    }
    throw error;
  }
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

interface IPropertyMemberInviteParams {
  inviteId: string;
  propertyId: string;
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
          decodePropertyFavoriteKeysetCursor(qs.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const q = typeof qs.q === "string" && qs.q.trim() !== "" ? qs.q.trim() : undefined;
      const isAdmin = request.user.userType === UserType.ADMIN;
      const { items, nextCursor } = isAdmin
        ? await propertiesDb.listPaginatedForAdmin({
            cursor: qs.cursor,
            limit,
            q,
            userId: request.user.userId,
          })
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
        const property = await propertiesDb.create(parsed.body, request.user.userId, client);
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
    async (request: FastifyRequest<{ Params: IPropertyParams }>, reply: FastifyReply) => {
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

      const property = await propertiesDb.findDetailById(propertyId, request.user.userId);
      return reply.send({ property });
    }
  );

  server.patch<{ Params: IPropertyParams }>(
    "/properties/:propertyId/favorite",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyParams }>, reply: FastifyReply) => {
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

      const parsed = parseSetPropertyFavoriteBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      await propertyUserFavoritesDb.setFavorite({
        favorite: parsed.body.favorite,
        propertyId,
        userId: request.user.userId,
      });

      const property = await propertiesDb.findById(propertyId, request.user.userId);
      return reply.send({ property });
    }
  );

  server.patch<{ Params: IPropertyParams }>(
    "/properties/:propertyId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyParams }>, reply: FastifyReply) => {
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

      const canManage = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can update property details"
      );
      if (!canManage) return;

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
    async (request: FastifyRequest<{ Params: IPropertyParams }>, reply: FastifyReply) => {
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

      const canManage = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can delete properties"
      );
      if (!canManage) return;

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
    async (request: FastifyRequest<{ Params: IPropertyParams }>, reply: FastifyReply) => {
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

      const canManageMembers = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage members"
      );
      if (!canManageMembers) return;

      const parsed = parseAddMemberBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const { email, role } = parsed.body;
      const creator = await userDb.findById(propertyExists.createdBy);
      if (creator?.email.toLowerCase() === email.toLowerCase()) {
        return reply.status(HttpStatus.CONFLICT).send({
          error: "The property creator is already assigned as owner",
        });
      }

      const targetUser = await userDb.findByEmail(email);
      if (targetUser) {
        return addExistingPropertyMember(
          request,
          reply,
          propertyExists,
          propertyId,
          targetUser,
          role
        );
      }

      return sendPropertyMemberInvite(request, reply, propertyId, email, role);
    }
  );

  server.post<{ Params: IPropertyMemberInviteParams }>(
    "/properties/:propertyId/member-invites/:inviteId/resend",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyMemberInviteParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const inviteId = parseUuidParam(request.params.inviteId);
      if (inviteId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid inviteId" });
      }

      const propertyExists = await assertPropertyAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!propertyExists) return;

      const canManageMembers = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage members"
      );
      if (!canManageMembers) return;

      try {
        const result = await propertyMemberInviteService.resendInvite({ inviteId, propertyId });
        return reply.send(result);
      } catch (error) {
        if (error instanceof PropertyMemberInviteMismatchError) {
          return reply.status(HttpStatus.NOT_FOUND).send({ error: error.message });
        }
        if (
          error instanceof PropertyMemberInviteNotFoundError ||
          error instanceof PropertyMemberInviteInvalidStateError
        ) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: (error as Error).message });
        }
        throw error;
      }
    }
  );

  server.patch<{ Params: IPropertyMemberParams }>(
    "/properties/:propertyId/members/:userId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyMemberParams }>, reply: FastifyReply) => {
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

      const canManageMembers = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can update member roles"
      );
      if (!canManageMembers) return;

      if (userId === propertyAccess.createdBy) {
        return reply.status(HttpStatus.FORBIDDEN).send({
          error: "The property creator cannot be modified or removed",
        });
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
    "/properties/:propertyId/members/:userId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyMemberParams }>, reply: FastifyReply) => {
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

      const canManageMembers = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can remove members"
      );
      if (!canManageMembers) return;

      if (userId === propertyAccess.createdBy) {
        return reply.status(HttpStatus.FORBIDDEN).send({
          error: "The property creator cannot be modified or removed",
        });
      }

      const removed = await propertyMembersDb.remove(propertyId, userId);
      if (!removed) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Member not found" });
      }

      notifyUser({
        body: `You no longer have access to ${propertyAccess.name}.`,
        resourceId: propertyId,
        resourceType: "property",
        title: `Removed from ${propertyAccess.name}`,
        type: "property_member_removed",
        userId,
      }).catch((err) => request.log.error(err));

      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
