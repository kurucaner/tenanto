import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import {
  HttpStatus,
  type ICreatePropertyLongStayBody,
  UnitRentalType,
} from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";
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

  return {
    body: {
      guestName: r["guestName"].trim(),
      leaseStartDate,
      monthlyRent,
      termMonths,
      unitId,
    },
    ok: true,
  };
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

export const propertyLongStayRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

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

      if (parsed.body.leaseStartDate < getTodayUtcIsoDate()) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "Lease start date cannot be in the past" });
      }

      const unit = await resolveLongTermUnitForProperty(parsed.body.unitId, propertyId, reply);
      if (!unit) return;

      const longStay = await propertyLongStaysDb.create(propertyId, parsed.body);
      return reply.status(HttpStatus.CREATED).send({ longStay });
    }
  );
};
