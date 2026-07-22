import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyIncomeLineTypesDb } from "@/db/property-income-line-types";
import { propertyIncomeLinesDb } from "@/db/property-income-lines";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyReservationsDb } from "@/db/property-reservations";
import { getTodayUtcIsoDate } from "@/lib/date-utils";
import { parseCreateIncomeLineBody } from "@/lib/parse-create-income-line-body";
import { resolveLeaseIncomeLineSystemType } from "@/lib/resolve-lease-income-line-system-type";
import { resolveLeaseIncomeRentPeriodKeyForLongStay } from "@/lib/resolve-lease-income-rent-period-key";
import {
  getIncomeLineRefundableCap,
  HttpStatus,
  type IPropertyIncomeLine,
  type IRefundLedgerEntryBody,
  type IUpdatePropertyIncomeLineBody,
  resolveIncomeLineRentPeriodKey as resolveIncomeLineRentPeriodKeyFromBody,
} from "@/packages/shared";
import { notifyPrimaryTenantRentRecorded } from "@/services/lease-notifications";
import { calculateMiscIncomeLine } from "@/services/property-income-calculator";

import { parseDateString, parseUuidParam } from "./admin-query-utils";
import {
  executeLedgerRefund,
  executeLedgerUnrefund,
  parseRefundLedgerEntryBody,
} from "./ledger-refund-route-actions";
import {
  parseJsonObject,
  parseMoney,
  parseNullablePeriodMonthField,
  parseNullableTrimmedStringField,
  parseNullableUuidField,
} from "./parse-body-utils";
import {
  buildPaginatedListResponse,
  shouldIncludeDeletedListItems,
} from "./parse-list-query-pagination";
import { parsePropertyIncomeLinesListQueryPaginated } from "./parse-property-income-lines-list-query";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
  requirePropertyMemberAccess,
} from "./property-route-access";
import { type IPropertyParams } from "./property-route-params";
import { rejectIfDeleted } from "./reject-if-deleted";
import { rejectIfRefunded } from "./reject-if-refunded";
import { resolvePropertyUnit } from "./resolve-property-unit";

function parseIncomeLineTypeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return parseUuidParam(raw);
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
  "rentPeriodKey",
  "rentPeriodMonth",
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
    case "rentPeriodKey":
    case "rentPeriodMonth": {
      if (body.rentPeriodKey !== undefined) {
        return null;
      }

      const rentPeriodKey =
        "rentPeriodKey" in r
          ? parseNullablePeriodMonthField(r["rentPeriodKey"], "rentPeriodKey")
          : { ok: true as const, value: undefined };
      if (!rentPeriodKey.ok) return rentPeriodKey.error;

      const rentPeriodMonth =
        "rentPeriodMonth" in r
          ? parseNullablePeriodMonthField(r["rentPeriodMonth"], "rentPeriodMonth")
          : { ok: true as const, value: undefined };
      if (!rentPeriodMonth.ok) return rentPeriodMonth.error;

      body.rentPeriodKey =
        resolveIncomeLineRentPeriodKeyFromBody({
          rentPeriodKey: rentPeriodKey.value ?? undefined,
          rentPeriodMonth: rentPeriodMonth.value ?? undefined,
        }) ?? null;
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

interface IPropertyIncomeLineParams {
  lineId: string;
  propertyId: string;
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
    propertyId,
    undefined,
    true
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
    rentPeriodKey: patch.rentPeriodKey === undefined ? existing.rentPeriodKey : patch.rentPeriodKey,
    reservationId: patch.reservationId === undefined ? existing.reservationId : patch.reservationId,
    transactionDate: patch.transactionDate ?? existing.transactionDate,
    unitId: patch.unitId === undefined ? existing.unitId : patch.unitId,
  };
}

async function resolveUpdatedIncomeLineRentPeriodKey(
  merged: ReturnType<typeof mergeIncomeLineInput>,
  patch: IUpdatePropertyIncomeLineBody
): Promise<{ ok: true; value: string | null } | { error: string; ok: false }> {
  if (!merged.longStayId) {
    return { ok: true, value: null };
  }

  const rentPeriodKey =
    patch.rentPeriodKey !== undefined ? patch.rentPeriodKey : merged.rentPeriodKey;

  const resolved = await resolveLeaseIncomeRentPeriodKeyForLongStay({
    longStayId: merged.longStayId,
    rentPeriodKey,
    transactionDate: merged.transactionDate,
  });

  if (!resolved.ok) {
    return resolved;
  }

  return { ok: true, value: resolved.value };
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
      const propertyId = await requirePropertyMemberAccess(request, reply);
      if (propertyId === null) return;

      const parsed = parsePropertyIncomeLinesListQueryPaginated(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const includeDeleted = shouldIncludeDeletedListItems(request.user.userType);
      const { incomeLines, meta, nextCursor } = await propertyIncomeLinesDb.listPaginatedByProperty(
        propertyId,
        parsed.filters,
        { cursor: parsed.cursor, includeDeleted, limit: parsed.limit }
      );
      return reply.send(
        buildPaginatedListResponse("incomeLines", incomeLines, meta, nextCursor ?? undefined)
      );
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

      const unitId = parsed.body.unitId ?? null;
      if (unitId !== null) {
        const unit = await resolvePropertyUnit(unitId, propertyId, reply);
        if (!unit) return;
      }

      let reservationId: string | null = parsed.body.reservationId ?? null;
      let longStayId: string | null = parsed.body.longStayId ?? null;

      let incomeLineTypeId: string;
      if (longStayId) {
        const systemType = await resolveLeaseIncomeLineSystemType(
          propertyId,
          parsed.body.isSecurityDeposit
        );
        incomeLineTypeId = systemType.id;
      } else {
        if (!parsed.body.incomeLineTypeId) {
          return reply
            .status(HttpStatus.BAD_REQUEST)
            .send({ error: "incomeLineTypeId must be a valid UUID" });
        }
        const incomeLineType = await resolveIncomeLineTypeForProperty(
          parsed.body.incomeLineTypeId,
          propertyId,
          reply
        );
        if (!incomeLineType) return;
        incomeLineTypeId = incomeLineType.id;
      }

      const guestName = await resolveIncomeLineGuestName(
        reservationId,
        longStayId,
        propertyId,
        unitId,
        parsed.body.guestName?.trim() || null,
        reply
      );
      if (guestName === undefined) return;

      let rentPeriodKey: string | null = null;
      if (longStayId && !parsed.body.isSecurityDeposit) {
        const resolvedRentPeriod = await resolveLeaseIncomeRentPeriodKeyForLongStay({
          longStayId,
          rentPeriodKey: parsed.body.rentPeriodKey,
          transactionDate: parsed.body.transactionDate,
        });
        if (!resolvedRentPeriod.ok) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: resolvedRentPeriod.error });
        }
        rentPeriodKey = resolvedRentPeriod.value;
      }

      const computed = calculateMiscIncomeLine(parsed.body.amount);
      const incomeLine = await propertyIncomeLinesDb.create(
        propertyId,
        {
          amount: parsed.body.amount,
          description: parsed.body.description?.trim() || null,
          guestName,
          incomeLineTypeId,
          longStayId,
          rentPeriodKey,
          reservationId,
          transactionDate: parsed.body.transactionDate,
          unitId,
        },
        computed
      );

      if (longStayId && !parsed.body.isSecurityDeposit) {
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

      if (parsed.body.incomeLineTypeId !== undefined) {
        const incomeLineType = await resolveIncomeLineTypeForProperty(
          merged.incomeLineTypeId,
          propertyId,
          reply
        );
        if (!incomeLineType) return;
      }

      if (merged.unitId !== null) {
        const unit = await resolvePropertyUnit(merged.unitId, propertyId, reply);
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

      const resolvedRentPeriod = await resolveUpdatedIncomeLineRentPeriodKey(merged, parsed.body);
      if (!resolvedRentPeriod.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: resolvedRentPeriod.error });
      }

      const computed = calculateMiscIncomeLine(merged.amount);
      const incomeLine = await propertyIncomeLinesDb.update(
        lineId,
        { ...parsed.body, rentPeriodKey: resolvedRentPeriod.value },
        computed
      );

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
