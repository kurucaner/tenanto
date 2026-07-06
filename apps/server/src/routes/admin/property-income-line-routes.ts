import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyIncomeLinesDb } from "@/db/property-income-lines";
import { propertyReservationsDb } from "@/db/property-reservations";
import { propertyUnitsDb } from "@/db/property-units";
import {
  HttpStatus,
  type ICreatePropertyIncomeLineBody,
  IncomeLineType,
  type IPropertyIncomeLine,
  type IPropertyIncomeLinesListQuery,
  type IUpdatePropertyIncomeLineBody,
  type TIncomeLineType,
} from "@/packages/shared";
import { calculateMiscIncomeLine } from "@/services/property-income-calculator";

import { parseOptionalUuid, parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";

const INCOME_LINE_TYPES = new Set<TIncomeLineType>(Object.values(IncomeLineType));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateString(raw: unknown): string | null {
  if (typeof raw !== "string" || !DATE_RE.test(raw.trim())) return null;
  const date = Date.parse(`${raw.trim()}T00:00:00Z`);
  if (!Number.isFinite(date)) return null;
  return raw.trim();
}

function parseIncomeLineType(raw: unknown): TIncomeLineType | null {
  if (typeof raw !== "string") return null;
  return INCOME_LINE_TYPES.has(raw as TIncomeLineType) ? (raw as TIncomeLineType) : null;
}

function parseMoney(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

function parseCreateIncomeLineBody(
  raw: unknown
): { body: ICreatePropertyIncomeLineBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;

  const lineType = parseIncomeLineType(r["lineType"]);
  if (lineType === null) {
    return {
      error: `lineType must be one of: ${[...INCOME_LINE_TYPES].join(", ")}`,
      ok: false,
    };
  }

  const unitId = parseUuidParam(r["unitId"]);
  if (unitId === null) return { error: "unitId must be a valid UUID", ok: false };

  const transactionDate = parseDateString(r["transactionDate"]);
  if (!transactionDate) {
    return { error: "transactionDate must be a YYYY-MM-DD date", ok: false };
  }

  const amount = parseMoney(r["amount"]);
  if (amount === null) return { error: "amount must be a non-negative number", ok: false };

  let reservationId: string | undefined;
  if (r["reservationId"] !== undefined && r["reservationId"] !== null && r["reservationId"] !== "") {
    const parsed = parseUuidParam(r["reservationId"]);
    if (parsed === null) return { error: "reservationId must be a valid UUID", ok: false };
    reservationId = parsed;
  }

  let description: string | undefined;
  if (r["description"] !== undefined && r["description"] !== null) {
    if (typeof r["description"] !== "string") {
      return { error: "description must be a string", ok: false };
    }
    description = r["description"].trim();
  }

  let guestName: string | undefined;
  if (r["guestName"] !== undefined && r["guestName"] !== null) {
    if (typeof r["guestName"] !== "string") {
      return { error: "guestName must be a string", ok: false };
    }
    guestName = r["guestName"].trim();
  }

  return {
    body: {
      amount,
      description,
      guestName,
      lineType,
      reservationId,
      transactionDate,
      unitId,
    },
    ok: true,
  };
}

const UPDATE_FIELDS = [
  "unitId",
  "reservationId",
  "lineType",
  "amount",
  "transactionDate",
  "description",
  "guestName",
] as const;

function parseUpdateIncomeLineBody(
  raw: unknown
): { body: IUpdatePropertyIncomeLineBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  const unknownKeys = Object.keys(r).filter(
    (key) => !UPDATE_FIELDS.includes(key as (typeof UPDATE_FIELDS)[number])
  );
  if (unknownKeys.length > 0) {
    return { error: `Unknown fields: ${unknownKeys.join(", ")}`, ok: false };
  }

  const body: IUpdatePropertyIncomeLineBody = {};

  if ("lineType" in r) {
    const lineType = parseIncomeLineType(r["lineType"]);
    if (lineType === null) {
      return {
        error: `lineType must be one of: ${[...INCOME_LINE_TYPES].join(", ")}`,
        ok: false,
      };
    }
    body.lineType = lineType;
  }
  if ("unitId" in r) {
    const unitId = parseUuidParam(r["unitId"]);
    if (unitId === null) return { error: "unitId must be a valid UUID", ok: false };
    body.unitId = unitId;
  }
  if ("transactionDate" in r) {
    const transactionDate = parseDateString(r["transactionDate"]);
    if (!transactionDate) {
      return { error: "transactionDate must be a YYYY-MM-DD date", ok: false };
    }
    body.transactionDate = transactionDate;
  }
  if ("amount" in r) {
    const amount = parseMoney(r["amount"]);
    if (amount === null) return { error: "amount must be a non-negative number", ok: false };
    body.amount = amount;
  }
  if ("reservationId" in r) {
    if (r["reservationId"] === null) {
      body.reservationId = null;
    } else {
      const reservationId = parseUuidParam(r["reservationId"]);
      if (reservationId === null) {
        return { error: "reservationId must be a valid UUID or null", ok: false };
      }
      body.reservationId = reservationId;
    }
  }
  if ("description" in r) {
    if (r["description"] === null) {
      body.description = null;
    } else if (typeof r["description"] === "string") {
      body.description = r["description"].trim();
    } else {
      return { error: "description must be a string or null", ok: false };
    }
  }
  if ("guestName" in r) {
    if (r["guestName"] === null) {
      body.guestName = null;
    } else if (typeof r["guestName"] === "string") {
      body.guestName = r["guestName"].trim();
    } else {
      return { error: "guestName must be a string or null", ok: false };
    }
  }

  if (Object.keys(body).length === 0) {
    return { error: "At least one field is required", ok: false };
  }

  return { body, ok: true };
}

function parseIncomeLinesListQuery(
  query: Record<string, unknown>
): { filters: IPropertyIncomeLinesListQuery; ok: true } | { error: string; ok: false } {
  const filters: IPropertyIncomeLinesListQuery = {};

  if (query["from"] !== undefined && query["from"] !== "") {
    const from = parseDateString(query["from"]);
    if (!from) return { error: "from must be a YYYY-MM-DD date", ok: false };
    filters.from = from;
  }
  if (query["to"] !== undefined && query["to"] !== "") {
    const to = parseDateString(query["to"]);
    if (!to) return { error: "to must be a YYYY-MM-DD date", ok: false };
    filters.to = to;
  }
  if (query["unitId"] !== undefined && query["unitId"] !== "") {
    const unitId = parseOptionalUuid(query["unitId"]);
    if (unitId === null) return { error: "unitId must be a valid UUID", ok: false };
    if (unitId) filters.unitId = unitId;
  }
  if (query["lineType"] !== undefined && query["lineType"] !== "") {
    const lineType = parseIncomeLineType(query["lineType"]);
    if (lineType === null) {
      return {
        error: `lineType must be one of: ${[...INCOME_LINE_TYPES].join(", ")}`,
        ok: false,
      };
    }
    filters.lineType = lineType;
  }
  if (query["reservationId"] !== undefined && query["reservationId"] !== "") {
    const reservationId = parseOptionalUuid(query["reservationId"]);
    if (reservationId === null) return { error: "reservationId must be a valid UUID", ok: false };
    if (reservationId) filters.reservationId = reservationId;
  }

  return { filters, ok: true };
}

interface IPropertyParams {
  propertyId: string;
}

interface IPropertyIncomeLineParams {
  lineId: string;
  propertyId: string;
}

async function resolveUnitForProperty(
  unitId: string,
  propertyId: string,
  reply: FastifyReply
) {
  const unit = await propertyUnitsDb.findById(unitId);
  if (!unit || unit.propertyId !== propertyId) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Unit not found for this property" });
    return null;
  }
  return unit;
}

async function resolveReservationForProperty(
  reservationId: string,
  propertyId: string,
  unitId: string,
  reply: FastifyReply
) {
  const reservation = await propertyReservationsDb.findById(reservationId);
  if (!reservation || reservation.propertyId !== propertyId) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Reservation not found for this property" });
    return null;
  }
  if (reservation.unitId !== unitId) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Reservation must belong to the selected unit" });
    return null;
  }
  return reservation;
}

function mergeIncomeLineInput(
  existing: IPropertyIncomeLine,
  patch: IUpdatePropertyIncomeLineBody
) {
  return {
    amount: patch.amount ?? existing.amount,
    description:
      patch.description === undefined ? existing.description : patch.description,
    guestName: patch.guestName === undefined ? existing.guestName : patch.guestName,
    lineType: patch.lineType ?? existing.lineType,
    reservationId:
      patch.reservationId === undefined ? existing.reservationId : patch.reservationId,
    transactionDate: patch.transactionDate ?? existing.transactionDate,
    unitId: patch.unitId ?? existing.unitId,
  };
}

export const propertyIncomeLineRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/income-lines",
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

      const parsed = parseIncomeLinesListQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const incomeLines = await propertyIncomeLinesDb.findByProperty(propertyId, parsed.filters);
      return reply.send({ incomeLines });
    }
  );

  server.post<{ Params: IPropertyParams }>(
    "/properties/:propertyId/income-lines",
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

      const isOwner = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage income entries"
      );
      if (!isOwner) return;

      const parsed = parseCreateIncomeLineBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const unit = await resolveUnitForProperty(parsed.body.unitId, propertyId, reply);
      if (!unit) return;

      let reservationId: string | null = parsed.body.reservationId ?? null;
      let guestName: string | null = parsed.body.guestName?.trim() || null;

      if (reservationId) {
        const reservation = await resolveReservationForProperty(
          reservationId,
          propertyId,
          parsed.body.unitId,
          reply
        );
        if (!reservation) return;
        if (!guestName) guestName = reservation.guestName;
      }

      const computed = calculateMiscIncomeLine(parsed.body.amount);
      const incomeLine = await propertyIncomeLinesDb.create(
        propertyId,
        {
          amount: parsed.body.amount,
          description: parsed.body.description?.trim() || null,
          guestName,
          lineType: parsed.body.lineType,
          reservationId,
          transactionDate: parsed.body.transactionDate,
          unitId: parsed.body.unitId,
        },
        computed
      );

      return reply.status(HttpStatus.CREATED).send({ incomeLine });
    }
  );

  server.patch<{ Params: IPropertyIncomeLineParams }>(
    "/properties/:propertyId/income-lines/:lineId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyIncomeLineParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const lineId = parseUuidParam(request.params.lineId);
      if (lineId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid lineId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const isOwner = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage income entries"
      );
      if (!isOwner) return;

      const existing = await propertyIncomeLinesDb.findById(lineId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Income line not found" });
      }

      const parsed = parseUpdateIncomeLineBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const merged = mergeIncomeLineInput(existing, parsed.body);
      const unit = await resolveUnitForProperty(merged.unitId, propertyId, reply);
      if (!unit) return;

      if (merged.reservationId) {
        const reservation = await resolveReservationForProperty(
          merged.reservationId,
          propertyId,
          merged.unitId,
          reply
        );
        if (!reservation) return;
        if (!merged.guestName) merged.guestName = reservation.guestName;
      }

      const computed = calculateMiscIncomeLine(merged.amount);
      const incomeLine = await propertyIncomeLinesDb.update(lineId, parsed.body, computed);

      return reply.send({ incomeLine });
    }
  );

  server.delete<{ Params: IPropertyIncomeLineParams }>(
    "/properties/:propertyId/income-lines/:lineId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyIncomeLineParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const lineId = parseUuidParam(request.params.lineId);
      if (lineId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid lineId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const isOwner = await assertPropertyLedgerWriteAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage income entries"
      );
      if (!isOwner) return;

      const existing = await propertyIncomeLinesDb.findById(lineId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Income line not found" });
      }

      await propertyIncomeLinesDb.delete(lineId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
