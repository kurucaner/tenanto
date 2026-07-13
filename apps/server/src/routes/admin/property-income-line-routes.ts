import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyIncomeLineTypesDb } from "@/db/property-income-line-types";
import { propertyIncomeLinesDb } from "@/db/property-income-lines";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyReservationsDb } from "@/db/property-reservations";
import { propertyUnitsDb } from "@/db/property-units";
import {
  getIncomeLineRefundableCap,
  HttpStatus,
  type ICreatePropertyIncomeLineBody,
  type IPropertyIncomeLine,
  type IPropertyIncomeLinesListQuery,
  type IRefundLedgerEntryBody,
  isRentIncomeLineType,
  type IUpdatePropertyIncomeLineBody,
  UserType,
} from "@/packages/shared";
import { decodeIncomeLineKeysetCursor } from "@/pagination/keyset-cursor";
import { notifyPrimaryTenantRentRecorded } from "@/services/lease-notifications";
import { calculateMiscIncomeLine } from "@/services/property-income-calculator";

import { parseDateString, parseIncomeEntriesListLimit, parseUuidParam } from "./admin-query-utils";
import {
  executeLedgerRefund,
  executeLedgerUnrefund,
  parseRefundLedgerEntryBody,
} from "./ledger-refund-route-actions";
import {
  parseJsonObject,
  parseMoney,
  parseNullableTrimmedStringField,
  parseNullableUuidField,
  parseOptionalTrimmedStringField,
  parseOptionalUuidField,
} from "./parse-body-utils";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQueryRefundStatusFilter,
  applyOptionalQuerySearchFilter,
  applyOptionalQueryUuidFilter,
} from "./parse-list-query-filters";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";
import { rejectIfDeleted } from "./reject-if-deleted";
import { rejectIfRefunded } from "./reject-if-refunded";

function getTodayUtcIsoDate(): string {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseIncomeLineTypeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return parseUuidParam(raw);
}

function parseCreateIncomeLineBody(
  raw: unknown
): { body: ICreatePropertyIncomeLineBody; ok: true } | { error: string; ok: false } {
  const r = parseJsonObject(raw);
  if (!r) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const incomeLineTypeId = parseIncomeLineTypeId(r["incomeLineTypeId"]);
  if (incomeLineTypeId === null) {
    return { error: "incomeLineTypeId must be a valid UUID", ok: false };
  }

  const unitIdResult = parseOptionalUuidField(r["unitId"], "unitId");
  if (!unitIdResult.ok) return unitIdResult;
  const unitId = unitIdResult.value ?? null;

  const transactionDate = parseDateString(r["transactionDate"]);
  if (!transactionDate) {
    return { error: "transactionDate must be a YYYY-MM-DD date", ok: false };
  }

  const amount = parseMoney(r["amount"]);
  if (amount === null) return { error: "amount must be a non-negative number", ok: false };

  const reservationResult = parseOptionalUuidField(r["reservationId"], "reservationId");
  if (!reservationResult.ok) return reservationResult;
  const longStayResult = parseOptionalUuidField(r["longStayId"], "longStayId");
  if (!longStayResult.ok) return longStayResult;

  if (reservationResult.value && longStayResult.value) {
    return { error: "Cannot link an income line to both a reservation and a long stay", ok: false };
  }

  const descriptionResult = parseOptionalTrimmedStringField(r["description"], "description");
  if (!descriptionResult.ok) return descriptionResult;
  const guestNameResult = parseOptionalTrimmedStringField(r["guestName"], "guestName");
  if (!guestNameResult.ok) return guestNameResult;

  return {
    body: {
      amount,
      description: descriptionResult.value,
      guestName: guestNameResult.value,
      incomeLineTypeId,
      longStayId: longStayResult.value,
      reservationId: reservationResult.value,
      transactionDate,
      unitId,
    },
    ok: true,
  };
}

const UPDATE_FIELDS = [
  "unitId",
  "reservationId",
  "longStayId",
  "incomeLineTypeId",
  "amount",
  "transactionDate",
  "description",
  "guestName",
] as const;

function applyUpdateIncomeLineField(
  r: Record<string, unknown>,
  body: IUpdatePropertyIncomeLineBody,
  field: (typeof UPDATE_FIELDS)[number]
): string | null {
  if (!(field in r)) return null;

  switch (field) {
    case "incomeLineTypeId": {
      const incomeLineTypeId = parseIncomeLineTypeId(r["incomeLineTypeId"]);
      if (incomeLineTypeId === null) return "incomeLineTypeId must be a valid UUID";
      body.incomeLineTypeId = incomeLineTypeId;
      return null;
    }
    case "unitId": {
      const unitId = parseNullableUuidField(r["unitId"], "unitId");
      if (!unitId.ok) return unitId.error;
      body.unitId = unitId.value;
      return null;
    }
    case "transactionDate": {
      const transactionDate = parseDateString(r["transactionDate"]);
      if (!transactionDate) return "transactionDate must be a YYYY-MM-DD date";
      body.transactionDate = transactionDate;
      return null;
    }
    case "amount": {
      const amount = parseMoney(r["amount"]);
      if (amount === null) return "amount must be a non-negative number";
      body.amount = amount;
      return null;
    }
    case "reservationId": {
      const reservationId = parseNullableUuidField(r["reservationId"], "reservationId");
      if (!reservationId.ok) return reservationId.error;
      body.reservationId = reservationId.value;
      return null;
    }
    case "longStayId": {
      const longStayId = parseNullableUuidField(r["longStayId"], "longStayId");
      if (!longStayId.ok) return longStayId.error;
      body.longStayId = longStayId.value;
      return null;
    }
    case "description": {
      const description = parseNullableTrimmedStringField(r["description"], "description");
      if (!description.ok) return description.error;
      body.description = description.value;
      return null;
    }
    case "guestName": {
      const guestName = parseNullableTrimmedStringField(r["guestName"], "guestName");
      if (!guestName.ok) return guestName.error;
      body.guestName = guestName.value;
      return null;
    }
    default:
      return null;
  }
}

function parseUpdateIncomeLineBody(
  raw: unknown
): { body: IUpdatePropertyIncomeLineBody; ok: true } | { error: string; ok: false } {
  const r = parseJsonObject(raw);
  if (!r) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const unknownKeys = Object.keys(r).filter(
    (key) => !UPDATE_FIELDS.includes(key as (typeof UPDATE_FIELDS)[number])
  );
  if (unknownKeys.length > 0) {
    return { error: `Unknown fields: ${unknownKeys.join(", ")}`, ok: false };
  }

  const body: IUpdatePropertyIncomeLineBody = {};
  for (const field of UPDATE_FIELDS) {
    const fieldError = applyUpdateIncomeLineField(r, body, field);
    if (fieldError) {
      return { error: fieldError, ok: false };
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

  const filterSteps = [
    () => applyOptionalQueryDateFilter(query, "from", filters, "from must be a YYYY-MM-DD date"),
    () => applyOptionalQueryDateFilter(query, "to", filters, "to must be a YYYY-MM-DD date"),
    () => applyOptionalQueryUuidFilter(query, "unitId", filters, "unitId must be a valid UUID"),
    () =>
      applyOptionalQueryUuidFilter(
        query,
        "reservationId",
        filters,
        "reservationId must be a valid UUID"
      ),
    () =>
      applyOptionalQueryUuidFilter(query, "longStayId", filters, "longStayId must be a valid UUID"),
    () => applyOptionalQuerySearchFilter(query, filters),
    () => applyOptionalQueryRefundStatusFilter(query, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) return result;
  }

  if (query["incomeLineTypeId"] !== undefined && query["incomeLineTypeId"] !== "") {
    const incomeLineTypeId = parseIncomeLineTypeId(query["incomeLineTypeId"]);
    if (incomeLineTypeId === null) {
      return { error: "incomeLineTypeId must be a valid UUID", ok: false };
    }
    filters.incomeLineTypeId = incomeLineTypeId;
  }

  return { filters, ok: true };
}

type TIncomeLineListRouteFilters = Omit<IPropertyIncomeLinesListQuery, "cursor" | "limit">;

function parseIncomeLinesListQueryPaginated(
  query: Record<string, unknown>
):
  | { cursor?: string; filters: TIncomeLineListRouteFilters; limit: number; ok: true }
  | { error: string; ok: false } {
  const parsed = parseIncomeLinesListQuery(query);
  if (!parsed.ok) {
    return parsed;
  }

  const limit = parseIncomeEntriesListLimit(query["limit"]);
  const cursor =
    typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

  return { cursor, filters: parsed.filters, limit, ok: true };
}

interface IPropertyParams {
  propertyId: string;
}

interface IPropertyIncomeLineParams {
  lineId: string;
  propertyId: string;
}

async function resolveUnitForProperty(unitId: string, propertyId: string, reply: FastifyReply) {
  const unit = await propertyUnitsDb.findById(unitId);
  if (!unit || unit.propertyId !== propertyId) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Unit not found for this property" });
    return null;
  }
  if (unit.isDeleted) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Unit has been deleted" });
    return null;
  }
  return unit;
}

async function resolveReservationForProperty(
  reservationId: string,
  propertyId: string,
  incomeUnitId: string | null,
  reply: FastifyReply
) {
  const reservation = await propertyReservationsDb.findById(reservationId);
  if (!reservation || reservation.propertyId !== propertyId) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Reservation not found for this property" });
    return null;
  }
  if (reservation.isDeleted) {
    void reply.status(HttpStatus.BAD_REQUEST).send({ error: "Reservation has been deleted" });
    return null;
  }
  // Property-amenity income (no unit) can still link to any stay in the property.
  if (incomeUnitId !== null && reservation.unitId !== incomeUnitId) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Reservation must belong to the selected unit" });
    return null;
  }
  return reservation;
}

async function resolveLongStayForProperty(
  longStayId: string,
  propertyId: string,
  incomeUnitId: string | null,
  reply: FastifyReply
) {
  const longStay = await propertyLongStaysDb.findById(longStayId);
  if (!longStay || longStay.propertyId !== propertyId) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Long stay not found for this property" });
    return null;
  }
  if (incomeUnitId !== null && longStay.unitId !== incomeUnitId) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Long stay must belong to the selected unit" });
    return null;
  }
  return longStay;
}

async function resolveIncomeLineTypeForProperty(
  incomeLineTypeId: string,
  propertyId: string,
  reply: FastifyReply
) {
  const incomeLineType = await propertyIncomeLineTypesDb.findByIdForProperty(
    incomeLineTypeId,
    propertyId
  );
  if (!incomeLineType) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Income type not found for this property" });
    return null;
  }
  return incomeLineType;
}

function mergeIncomeLineInput(existing: IPropertyIncomeLine, patch: IUpdatePropertyIncomeLineBody) {
  return {
    amount: patch.amount ?? existing.amount,
    description: patch.description === undefined ? existing.description : patch.description,
    guestName: patch.guestName === undefined ? existing.guestName : patch.guestName,
    incomeLineTypeId: patch.incomeLineTypeId ?? existing.incomeLineTypeId,
    longStayId: patch.longStayId === undefined ? existing.longStayId : patch.longStayId,
    reservationId: patch.reservationId === undefined ? existing.reservationId : patch.reservationId,
    transactionDate: patch.transactionDate ?? existing.transactionDate,
    unitId: patch.unitId === undefined ? existing.unitId : patch.unitId,
  };
}

async function resolveIncomeLineGuestName(
  reservationId: string | null,
  longStayId: string | null,
  propertyId: string,
  unitId: string | null,
  guestName: string | null,
  reply: FastifyReply
): Promise<string | null | undefined> {
  let resolvedGuestName = guestName;

  if (reservationId) {
    const reservation = await resolveReservationForProperty(
      reservationId,
      propertyId,
      unitId,
      reply
    );
    if (!reservation) return undefined;
    if (!resolvedGuestName) resolvedGuestName = reservation.guestName;
  }

  if (longStayId) {
    const longStay = await resolveLongStayForProperty(longStayId, propertyId, unitId, reply);
    if (!longStay) return undefined;
    if (!resolvedGuestName) resolvedGuestName = longStay.guestName;
  }

  return resolvedGuestName;
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

      const parsed = parseIncomeLinesListQueryPaginated(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      if (parsed.cursor != null) {
        try {
          decodeIncomeLineKeysetCursor(parsed.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const includeDeleted = request.user.userType === UserType.ADMIN;
      const { incomeLines, meta, nextCursor } = await propertyIncomeLinesDb.listPaginatedByProperty(
        propertyId,
        parsed.filters,
        { cursor: parsed.cursor, includeDeleted, limit: parsed.limit }
      );
      return reply.send(meta ? { incomeLines, meta, nextCursor } : { incomeLines, nextCursor });
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
        "Only property owners and managers can manage income entries"
      );
      if (!isOwner) return;

      const parsed = parseCreateIncomeLineBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      if (parsed.body.transactionDate > getTodayUtcIsoDate()) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "Transaction date cannot be in the future" });
      }

      const incomeLineType = await resolveIncomeLineTypeForProperty(
        parsed.body.incomeLineTypeId,
        propertyId,
        reply
      );
      if (!incomeLineType) return;

      const unitId = parsed.body.unitId ?? null;
      if (unitId !== null) {
        const unit = await resolveUnitForProperty(unitId, propertyId, reply);
        if (!unit) return;
      }

      let reservationId: string | null = parsed.body.reservationId ?? null;
      let longStayId: string | null = parsed.body.longStayId ?? null;
      const guestName = await resolveIncomeLineGuestName(
        reservationId,
        longStayId,
        propertyId,
        unitId,
        parsed.body.guestName?.trim() || null,
        reply
      );
      if (guestName === undefined) return;

      const computed = calculateMiscIncomeLine(parsed.body.amount);
      const incomeLine = await propertyIncomeLinesDb.create(
        propertyId,
        {
          amount: parsed.body.amount,
          description: parsed.body.description?.trim() || null,
          guestName,
          incomeLineTypeId: incomeLineType.id,
          longStayId,
          reservationId,
          transactionDate: parsed.body.transactionDate,
          unitId,
        },
        computed
      );

      if (longStayId && isRentIncomeLineType(incomeLineType)) {
        void notifyPrimaryTenantRentRecorded({
          amount: parsed.body.amount,
          longStayId,
          propertyId,
          transactionDate: parsed.body.transactionDate,
        }).catch((err) => {
          request.log.error({ err, longStayId, propertyId }, "Failed to send rent receipt email");
        });
      }

      return reply.status(HttpStatus.CREATED).send({ incomeLine });
    }
  );

  server.patch<{ Params: IPropertyIncomeLineParams }>(
    "/properties/:propertyId/income-lines/:lineId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyIncomeLineParams }>, reply: FastifyReply) => {
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
        "Only property owners and managers can manage income entries"
      );
      if (!isOwner) return;

      const existing = await propertyIncomeLinesDb.findById(lineId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Income line not found" });
      }

      if (rejectIfDeleted(existing, reply, "income line")) return;
      if (rejectIfRefunded(existing, reply, "income line")) return;

      const parsed = parseUpdateIncomeLineBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const merged = mergeIncomeLineInput(existing, parsed.body);

      const incomeLineType = await resolveIncomeLineTypeForProperty(
        merged.incomeLineTypeId,
        propertyId,
        reply
      );
      if (!incomeLineType) return;

      if (merged.unitId !== null) {
        const unit = await resolveUnitForProperty(merged.unitId, propertyId, reply);
        if (!unit) return;
      }

      if (merged.reservationId && merged.longStayId) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "Cannot link an income line to both a reservation and a long stay" });
      }

      const resolvedGuestName = await resolveIncomeLineGuestName(
        merged.reservationId,
        merged.longStayId,
        propertyId,
        merged.unitId,
        merged.guestName,
        reply
      );
      if (resolvedGuestName === undefined) return;
      merged.guestName = resolvedGuestName;

      const computed = calculateMiscIncomeLine(merged.amount);
      const incomeLine = await propertyIncomeLinesDb.update(lineId, parsed.body, computed);

      return reply.send({ incomeLine });
    }
  );

  server.delete<{ Params: IPropertyIncomeLineParams }>(
    "/properties/:propertyId/income-lines/:lineId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyIncomeLineParams }>, reply: FastifyReply) => {
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
        "Only property owners and managers can manage income entries"
      );
      if (!isOwner) return;

      const existing = await propertyIncomeLinesDb.findById(lineId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Income line not found" });
      }

      if (rejectIfDeleted(existing, reply, "income line")) return;

      await propertyIncomeLinesDb.softDelete(lineId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );

  server.post<{ Params: IPropertyIncomeLineParams }>(
    "/properties/:propertyId/income-lines/:lineId/restore",
    { preHandler: [server.authenticate, server.requireAdmin] },
    async (request: FastifyRequest<{ Params: IPropertyIncomeLineParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const lineId = parseUuidParam(request.params.lineId);
      if (lineId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid lineId" });
      }

      const existing = await propertyIncomeLinesDb.findById(lineId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Income line not found" });
      }

      await propertyIncomeLinesDb.restore(lineId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );

  server.post<{ Body: IRefundLedgerEntryBody; Params: IPropertyIncomeLineParams }>(
    "/properties/:propertyId/income-lines/:lineId/refund",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Body: IRefundLedgerEntryBody; Params: IPropertyIncomeLineParams }>,
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
        "Only property owners and managers can manage income entries"
      );
      if (!isOwner) return;

      const existing = await propertyIncomeLinesDb.findById(lineId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Income line not found" });
      }

      const parsedBody = parseRefundLedgerEntryBody(request.body);
      if (!parsedBody.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsedBody.error });
      }

      await executeLedgerRefund(reply, {
        body: parsedBody.body,
        db: propertyIncomeLinesDb,
        entity: existing,
        entityId: lineId,
        entityName: "Income line",
        label: "income line",
        notFoundError: "Income line not found",
        propertyId,
        refundableCap: getIncomeLineRefundableCap(existing),
        userId: request.user.userId,
      });
    }
  );

  server.post<{ Params: IPropertyIncomeLineParams }>(
    "/properties/:propertyId/income-lines/:lineId/unrefund",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyIncomeLineParams }>, reply: FastifyReply) => {
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
        "Only property owners and managers can manage income entries"
      );
      if (!isOwner) return;

      const existing = await propertyIncomeLinesDb.findById(lineId);
      await executeLedgerUnrefund(reply, {
        db: propertyIncomeLinesDb,
        entity: existing,
        entityId: lineId,
        entityName: "Income line",
        notFoundError: "Income line not found",
        propertyId,
      });
    }
  );
};
