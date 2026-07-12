import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyUnitsDb } from "@/db/property-units";
import {
  HttpStatus,
  type ICreatePropertyUnitBody,
  type IUpdatePropertyUnitBody,
  type TPropertyUnitsListSortBy,
  type TPropertyUnitsListSortDir,
  type TUnitRentalType,
  UnitRentalType,
  UNITS_LIST_LIMIT,
  UNITS_LIST_MAX_LIMIT,
  UserType,
} from "@/packages/shared";
import { decodeUnitKeysetCursor } from "@/pagination/keyset-cursor";

import { parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyMemberAccess,
  assertPropertyUnitManageAccess,
} from "./property-route-access";
import {
  duplicateUnitNumberMessage,
  formatUnitDeleteBlockedMessage,
  getUnitDeleteBlockerCode,
  UNIT_DELETE_FOREIGN_KEY_FALLBACK,
} from "./property-unit-errors";
import { rejectIfDeleted } from "./reject-if-deleted";
import { replyFromDatabaseError } from "./reply-from-database-error";

const UNIT_RENTAL_TYPES = new Set<TUnitRentalType>(Object.values(UnitRentalType));

function parseUnitsListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return UNITS_LIST_LIMIT;
  return Math.min(UNITS_LIST_MAX_LIMIT, Math.floor(n));
}

function parseUnitsListSortBy(raw: unknown): TPropertyUnitsListSortBy | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "type") return "type";
  return null;
}

function parseUnitsListSortDir(raw: unknown): TPropertyUnitsListSortDir | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "asc" || raw === "desc") return raw;
  return null;
}

function parseUnitsListQuery(query: Record<string, unknown>):
  | {
      cursor?: string;
      isPaginated: boolean;
      limit: number;
      ok: true;
      sortBy: TPropertyUnitsListSortBy;
      sortDir: TPropertyUnitsListSortDir;
    }
  | { error: string; ok: false } {
  const isPaginated =
    (query["limit"] !== undefined && query["limit"] !== "") ||
    (typeof query["cursor"] === "string" && query["cursor"] !== "");

  const limit = parseUnitsListLimit(query["limit"]);
  const cursor =
    typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

  const sortByRaw = parseUnitsListSortBy(query["sortBy"]);
  if (sortByRaw === null) {
    return { error: 'sortBy must be "type"', ok: false };
  }

  const sortDirRaw = parseUnitsListSortDir(query["sortDir"]);
  if (sortDirRaw === null) {
    return { error: 'sortDir must be "asc" or "desc"', ok: false };
  }

  return {
    cursor,
    isPaginated,
    limit,
    ok: true,
    sortBy: sortByRaw ?? "type",
    sortDir: sortDirRaw ?? "asc",
  };
}

function parseRentalType(raw: unknown): TUnitRentalType | null {
  if (typeof raw !== "string") return null;
  return UNIT_RENTAL_TYPES.has(raw as TUnitRentalType) ? (raw as TUnitRentalType) : null;
}

function parseCreateUnitBody(
  raw: unknown
): { body: ICreatePropertyUnitBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r["unitNumber"] !== "string" || r["unitNumber"].trim() === "") {
    return { error: "unitNumber is required", ok: false };
  }

  if (typeof r["layout"] !== "string" || r["layout"].trim() === "") {
    return { error: "layout is required", ok: false };
  }
  const rentalType = parseRentalType(r["rentalType"]);
  if (rentalType === null) {
    return {
      error: `rentalType must be one of: ${[...UNIT_RENTAL_TYPES].join(", ")}`,
      ok: false,
    };
  }
  return {
    body: {
      layout: r["layout"].trim(),
      rentalType,
      unitNumber: r["unitNumber"].trim(),
    },
    ok: true,
  };
}

function parseUpdateUnitBody(
  raw: unknown
): { body: IUpdatePropertyUnitBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  const body: IUpdatePropertyUnitBody = {};

  if ("unitNumber" in r) {
    if (typeof r["unitNumber"] !== "string" || r["unitNumber"].trim() === "") {
      return { error: "unitNumber must be a non-empty string", ok: false };
    }
    body.unitNumber = r["unitNumber"].trim();
  }
  if ("layout" in r) {
    if (typeof r["layout"] !== "string" || r["layout"].trim() === "") {
      return { error: "layout must be a non-empty string", ok: false };
    }
    body.layout = r["layout"].trim();
  }
  if ("rentalType" in r) {
    const rentalType = parseRentalType(r["rentalType"]);
    if (rentalType === null) {
      return {
        error: `rentalType must be one of: ${[...UNIT_RENTAL_TYPES].join(", ")}`,
        ok: false,
      };
    }
    body.rentalType = rentalType;
  }
  return { body, ok: true };
}

interface IPropertyUnitParams {
  propertyId: string;
  unitId: string;
}

interface IPropertyParams {
  propertyId: string;
}

const unitDatabaseErrorOptions = (duplicateMessage: string) => ({
  duplicateMessage,
  foreignKeyFallback: UNIT_DELETE_FOREIGN_KEY_FALLBACK,
});

export const propertyUnitRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/units",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const parsed = parseUnitsListQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      if (parsed.cursor != null) {
        try {
          decodeUnitKeysetCursor(parsed.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const includeDeleted = request.user.userType === UserType.ADMIN;

      if (parsed.isPaginated) {
        const { meta, nextCursor, units } = await propertyUnitsDb.listPaginatedByProperty(
          propertyId,
          {
            cursor: parsed.cursor,
            includeDeleted,
            limit: parsed.limit,
            sortBy: parsed.sortBy,
            sortDir: parsed.sortDir,
          }
        );
        return reply.send(meta ? { meta, nextCursor, units } : { nextCursor, units });
      }

      const [units, meta] = await Promise.all([
        propertyUnitsDb.findByProperty(propertyId, includeDeleted),
        propertyUnitsDb.getListMetaByProperty(propertyId, includeDeleted),
      ]);
      return reply.send({ meta, nextCursor: null, units });
    }
  );

  server.post<{ Params: IPropertyParams }>(
    "/properties/:propertyId/units",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const canManageUnits = await assertPropertyUnitManageAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners and managers can manage units"
      );
      if (!canManageUnits) return;

      const parsed = parseCreateUnitBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      try {
        const unit = await propertyUnitsDb.create(propertyId, parsed.body);
        return reply.status(HttpStatus.CREATED).send({ unit });
      } catch (error) {
        if (
          replyFromDatabaseError(
            reply,
            error,
            unitDatabaseErrorOptions(duplicateUnitNumberMessage())
          )
        ) {
          return;
        }
        throw error;
      }
    }
  );

  server.patch<{ Params: IPropertyUnitParams }>(
    "/properties/:propertyId/units/:unitId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyUnitParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const unitId = parseUuidParam(request.params.unitId);
      if (unitId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid unitId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const canManageUnits = await assertPropertyUnitManageAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners and managers can manage units"
      );
      if (!canManageUnits) return;

      const existing = await propertyUnitsDb.findById(unitId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Unit not found" });
      }

      if (rejectIfDeleted(existing, reply, "unit")) return;

      const parsed = parseUpdateUnitBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      try {
        const updated = await propertyUnitsDb.update(unitId, parsed.body);
        return reply.send({ unit: updated });
      } catch (error) {
        if (
          replyFromDatabaseError(
            reply,
            error,
            unitDatabaseErrorOptions(duplicateUnitNumberMessage())
          )
        ) {
          return;
        }
        throw error;
      }
    }
  );

  server.delete<{ Params: IPropertyUnitParams }>(
    "/properties/:propertyId/units/:unitId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyUnitParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const unitId = parseUuidParam(request.params.unitId);
      if (unitId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid unitId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const canManageUnits = await assertPropertyUnitManageAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners and managers can manage units"
      );
      if (!canManageUnits) return;

      const existing = await propertyUnitsDb.findById(unitId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Unit not found" });
      }

      if (rejectIfDeleted(existing, reply, "unit")) return;

      const blockers = await propertyUnitsDb.getUnitDeleteBlockers(unitId);
      if (
        blockers.reservationCount > 0 ||
        blockers.incomeLineCount > 0 ||
        blockers.longStayCount > 0
      ) {
        const code = getUnitDeleteBlockerCode(blockers);
        const payload = {
          error: formatUnitDeleteBlockedMessage(blockers),
          ...(code === undefined ? {} : { code }),
        };
        return reply.status(HttpStatus.CONFLICT).send(payload);
      }

      try {
        await propertyUnitsDb.softDelete(unitId);
        return reply.status(HttpStatus.NO_CONTENT).send();
      } catch (error) {
        if (
          replyFromDatabaseError(reply, error, {
            foreignKeyFallback: UNIT_DELETE_FOREIGN_KEY_FALLBACK,
          })
        ) {
          return;
        }
        throw error;
      }
    }
  );

  server.post<{ Params: IPropertyUnitParams }>(
    "/properties/:propertyId/units/:unitId/restore",
    { preHandler: [server.authenticate, server.requireAdmin] },
    async (request: FastifyRequest<{ Params: IPropertyUnitParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const unitId = parseUuidParam(request.params.unitId);
      if (unitId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid unitId" });
      }

      const existing = await propertyUnitsDb.findById(unitId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Unit not found" });
      }

      await propertyUnitsDb.restore(unitId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
