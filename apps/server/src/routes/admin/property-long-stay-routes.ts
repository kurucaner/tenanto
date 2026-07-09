import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  ActiveLongStayConflictError,
  LongStayNotActiveError,
  LongStayNotFoundError,
  propertyLongStaysDb,
} from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import {
  HttpStatus,
  type ICreatePropertyLongStayBody,
  type IEndPropertyLongStayBody,
  type IPropertyLongStaysListQuery,
  PropertyLongStayStatus,
  type TPropertyLongStayStatus,
  UnitRentalType,
} from "@/packages/shared";

import { parseOptionalUuid, parseUuidParam } from "./admin-query-utils";
import { assertPropertyLedgerWriteAccess, assertPropertyMemberAccess } from "./property-route-access";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TERM_MONTHS = 60;

function parseDateString(raw: unknown): string | null {
  if (typeof raw !== "string" || !DATE_RE.test(raw.trim())) return null;
  const date = Date.parse(`${raw.trim()}T00:00:00Z`);
  if (!Number.isFinite(date)) return null;
  return raw.trim();
}

function getTodayUtcIsoDate(): string {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseMoney(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

function parseTermMonths(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
  if (raw < 1 || raw > MAX_TERM_MONTHS) return null;
  return raw;
}

function parseOptionalString(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function parseCreateLongStayBody(
  raw: unknown
): { body: ICreatePropertyLongStayBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;

  const unitId = parseUuidParam(r["unitId"]);
  if (unitId === null) return { error: "unitId must be a valid UUID", ok: false };

  if (typeof r["guestName"] !== "string" || r["guestName"].trim() === "") {
    return { error: "guestName is required", ok: false };
  }

  const leaseStartDate = parseDateString(r["leaseStartDate"]);
  if (!leaseStartDate) {
    return { error: "leaseStartDate must be a YYYY-MM-DD date", ok: false };
  }

  const termMonths = parseTermMonths(r["termMonths"]);
  if (termMonths === null) {
    return {
      error: `termMonths must be a whole number between 1 and ${MAX_TERM_MONTHS}`,
      ok: false,
    };
  }

  const monthlyRent = parseMoney(r["monthlyRent"]);
  if (monthlyRent === null) {
    return { error: "monthlyRent must be a non-negative number", ok: false };
  }

  const tenantEmail = parseOptionalString(r["tenantEmail"]);
  if (r["tenantEmail"] !== undefined && r["tenantEmail"] !== null && tenantEmail === null) {
    return { error: "tenantEmail must be a string", ok: false };
  }

  const tenantPhone = parseOptionalString(r["tenantPhone"]);
  if (r["tenantPhone"] !== undefined && r["tenantPhone"] !== null && tenantPhone === null) {
    return { error: "tenantPhone must be a string", ok: false };
  }

  return {
    body: {
      guestName: r["guestName"].trim(),
      leaseStartDate,
      monthlyRent,
      tenantEmail: tenantEmail ?? undefined,
      tenantPhone: tenantPhone ?? undefined,
      termMonths,
      unitId,
    },
    ok: true,
  };
}

function parseEndLongStayBody(
  raw: unknown
): { body: IEndPropertyLongStayBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  const actualEndDate = parseDateString(r["actualEndDate"]);
  if (!actualEndDate) {
    return { error: "actualEndDate must be a YYYY-MM-DD date", ok: false };
  }
  return { body: { actualEndDate }, ok: true };
}

function parseLongStaysListQuery(
  query: Record<string, unknown>
): { filters: IPropertyLongStaysListQuery; ok: true } | { error: string; ok: false } {
  const filters: IPropertyLongStaysListQuery = {};

  if (query["status"] !== undefined && query["status"] !== "") {
    const status = query["status"];
    if (status !== PropertyLongStayStatus.ACTIVE && status !== PropertyLongStayStatus.ENDED) {
      return { error: "status must be active or ended", ok: false };
    }
    filters.status = status as TPropertyLongStayStatus;
  }

  if (query["unitId"] !== undefined && query["unitId"] !== "") {
    const unitId = parseOptionalUuid(query["unitId"]);
    if (unitId === null) return { error: "unitId must be a valid UUID", ok: false };
    if (unitId) filters.unitId = unitId;
  }

  return { filters, ok: true };
}

async function resolveLongTermUnitForProperty(
  unitId: string,
  propertyId: string,
  reply: FastifyReply
) {
  const unit = await propertyUnitsDb.findById(unitId);
  if (!unit || unit.propertyId !== propertyId) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Unit not found for this property" });
    return null;
  }
  if (unit.rentalType !== UnitRentalType.LONG_TERM) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Long stays can only be created for long-term units" });
    return null;
  }
  if (unit.isDeleted) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Unit has been deleted" });
    return null;
  }
  return unit;
}

interface IPropertyParams {
  propertyId: string;
}

interface IPropertyLongStayParams {
  longStayId: string;
  propertyId: string;
}

export const propertyLongStayRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/long-stays",
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

      const parsed = parseLongStaysListQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const longStays = await propertyLongStaysDb.listByProperty(propertyId, parsed.filters);
      return reply.send({ longStays });
    }
  );

  server.get<{ Params: IPropertyLongStayParams }>(
    "/properties/:propertyId/long-stays/:longStayId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyLongStayParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const longStay = await propertyLongStaysDb.findById(longStayId);
      if (!longStay || longStay.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Long stay not found" });
      }

      const rentSchedule = await propertyLongStaysDb.getRentSchedule(longStayId);
      return reply.send({ longStay, rentSchedule });
    }
  );

  server.post<{ Params: IPropertyParams }>(
    "/properties/:propertyId/long-stays",
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

      const canWriteLedger = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners and managers can manage long stays"
      );
      if (!canWriteLedger) return;

      const parsed = parseCreateLongStayBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const unit = await resolveLongTermUnitForProperty(parsed.body.unitId, propertyId, reply);
      if (!unit) return;

      try {
        const longStay = await propertyLongStaysDb.create(propertyId, parsed.body);
        return reply.status(HttpStatus.CREATED).send({ longStay });
      } catch (error) {
        if (error instanceof ActiveLongStayConflictError) {
          return reply.status(HttpStatus.CONFLICT).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  server.post<{ Params: IPropertyLongStayParams }>(
    "/properties/:propertyId/long-stays/:longStayId/end",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyLongStayParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const canWriteLedger = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners and managers can manage long stays"
      );
      if (!canWriteLedger) return;

      const existing = await propertyLongStaysDb.findById(longStayId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Long stay not found" });
      }

      const parsed = parseEndLongStayBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const today = getTodayUtcIsoDate();
      if (parsed.body.actualEndDate > today) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "Move-out date cannot be in the future" });
      }
      if (parsed.body.actualEndDate < existing.leaseStartDate) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "Move-out date cannot be before lease start date" });
      }

      try {
        const longStay = await propertyLongStaysDb.endLease(longStayId, parsed.body.actualEndDate);
        return reply.send({ longStay });
      } catch (error) {
        if (error instanceof LongStayNotActiveError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        if (error instanceof LongStayNotFoundError) {
          return reply.status(HttpStatus.NOT_FOUND).send({ error: error.message });
        }
        throw error;
      }
    }
  );
};
