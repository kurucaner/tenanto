import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyUnitsDb } from "@/db/property-units";
import {
  HttpStatus,
  type ICreatePropertyUnitBody,
  type IUpdatePropertyUnitBody,
  type TUnitRentalType,
  UnitRentalType,
} from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyMemberAccess,
  assertPropertyStructureAccess,
} from "./property-route-access";

const UNIT_RENTAL_TYPES = new Set<TUnitRentalType>(Object.values(UnitRentalType));

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
  return { body: { layout: r["layout"].trim(), rentalType, unitNumber: r["unitNumber"].trim() }, ok: true };
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

export const propertyUnitRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams }>(
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

      const units = await propertyUnitsDb.findByProperty(propertyId);
      return reply.send({ units });
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

      const isOwner = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage units"
      );
      if (!isOwner) return;

      const parsed = parseCreateUnitBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const unit = await propertyUnitsDb.create(propertyId, parsed.body);
      return reply.status(HttpStatus.CREATED).send({ unit });
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

      const isOwner = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage units"
      );
      if (!isOwner) return;

      const existing = await propertyUnitsDb.findById(unitId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Unit not found" });
      }

      const parsed = parseUpdateUnitBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const updated = await propertyUnitsDb.update(unitId, parsed.body);
      return reply.send({ unit: updated });
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

      const isOwner = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage units"
      );
      if (!isOwner) return;

      const existing = await propertyUnitsDb.findById(unitId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Unit not found" });
      }

      await propertyUnitsDb.delete(unitId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
