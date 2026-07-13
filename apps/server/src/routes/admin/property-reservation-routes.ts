import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyChannelCommissionsDb } from "@/db/property-channel-commissions";
import { propertyReservationsDb } from "@/db/property-reservations";
import { propertySettingsDb } from "@/db/property-settings";
import { propertyUnitsDb } from "@/db/property-units";
import {
  HttpStatus,
  type ICreatePropertyReservationBody,
  type IPropertyReservation,
  type IPropertyReservationsListQuery,
  type IUpdatePropertyReservationBody,
  ReservationStatus,
  type TReservationStatus,
  type TUnitRentalType,
  UnitRentalType,
  UserType,
} from "@/packages/shared";
import { calculateNights, calculateStayIncome } from "@/services/property-income-calculator";

import { parseDateString, parseUuidParam } from "./admin-query-utils";
import { executeLedgerRefund, executeLedgerUnrefund } from "./ledger-refund-route-actions";
import { parseJsonObject, parseMoney, parseNullableTrimmedStringField } from "./parse-body-utils";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQueryUuidFilter,
} from "./parse-list-query-filters";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";
import { rejectIfDeleted } from "./reject-if-deleted";
import { rejectIfRefunded } from "./reject-if-refunded";

const RESERVATION_STATUSES = new Set<TReservationStatus>(Object.values(ReservationStatus));
const UNIT_RENTAL_TYPES = new Set<TUnitRentalType>(Object.values(UnitRentalType));

function parseReservationStatus(raw: unknown): TReservationStatus | null {
  if (typeof raw !== "string") return null;
  return RESERVATION_STATUSES.has(raw as TReservationStatus) ? (raw as TReservationStatus) : null;
}

function parseReservationChannelCommissionId(raw: unknown): string | null {
  return parseUuidParam(raw);
}

function parseCreateReservationBody(
  raw: unknown
): { body: ICreatePropertyReservationBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r["guestName"] !== "string" || r["guestName"].trim() === "") {
    return { error: "guestName is required", ok: false };
  }
  const unitId = parseUuidParam(r["unitId"]);
  if (unitId === null) return { error: "unitId must be a valid UUID", ok: false };

  const checkIn = parseDateString(r["checkIn"]);
  const checkOut = parseDateString(r["checkOut"]);
  if (!checkIn || !checkOut) {
    return { error: "checkIn and checkOut must be YYYY-MM-DD dates", ok: false };
  }

  const status = parseReservationStatus(r["status"]);
  if (status === null) {
    return {
      error: `status must be one of: ${[...RESERVATION_STATUSES].join(", ")}`,
      ok: false,
    };
  }

  const channelCommissionId = parseReservationChannelCommissionId(r["channelCommissionId"]);
  if (channelCommissionId === null) {
    return { error: "channelCommissionId must be a valid UUID", ok: false };
  }

  const roomTotal = parseMoney(r["roomTotal"]);
  if (roomTotal === null) return { error: "roomTotal must be a non-negative number", ok: false };

  const cleaningFee = parseMoney(r["cleaningFee"]);
  if (cleaningFee === null) {
    return { error: "cleaningFee must be a non-negative number", ok: false };
  }

  let reservationNumber: string | undefined;
  if (r["reservationNumber"] !== undefined && r["reservationNumber"] !== null) {
    if (typeof r["reservationNumber"] !== "string") {
      return { error: "reservationNumber must be a string", ok: false };
    }
    reservationNumber = r["reservationNumber"].trim();
  }

  return {
    body: {
      channelCommissionId,
      checkIn,
      checkOut,
      cleaningFee,
      guestName: r["guestName"].trim(),
      reservationNumber,
      roomTotal,
      status,
      unitId,
    },
    ok: true,
  };
}

const UPDATE_FIELDS = [
  "unitId",
  "guestName",
  "reservationNumber",
  "checkIn",
  "checkOut",
  "status",
  "channelCommissionId",
  "roomTotal",
  "cleaningFee",
] as const;

type TUpdateReservationField = (typeof UPDATE_FIELDS)[number];

type TUpdateReservationFieldParser = (
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
) => string | null;

function parseUpdateGuestName(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  if (typeof r["guestName"] !== "string" || r["guestName"].trim() === "") {
    return "guestName must be a non-empty string";
  }
  body.guestName = r["guestName"].trim();
  return null;
}

function parseUpdateUnitId(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  const unitId = parseUuidParam(r["unitId"]);
  if (unitId === null) return "unitId must be a valid UUID";
  body.unitId = unitId;
  return null;
}

function parseUpdateCheckIn(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  const checkIn = parseDateString(r["checkIn"]);
  if (!checkIn) return "checkIn must be a YYYY-MM-DD date";
  body.checkIn = checkIn;
  return null;
}

function parseUpdateCheckOut(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  const checkOut = parseDateString(r["checkOut"]);
  if (!checkOut) return "checkOut must be a YYYY-MM-DD date";
  body.checkOut = checkOut;
  return null;
}

function parseUpdateStatus(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  const status = parseReservationStatus(r["status"]);
  if (status === null) {
    return `status must be one of: ${[...RESERVATION_STATUSES].join(", ")}`;
  }
  body.status = status;
  return null;
}

function parseUpdateChannelCommissionId(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  const channelCommissionId = parseReservationChannelCommissionId(r["channelCommissionId"]);
  if (channelCommissionId === null) {
    return "channelCommissionId must be a valid UUID";
  }
  body.channelCommissionId = channelCommissionId;
  return null;
}

function parseUpdateRoomTotal(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  const roomTotal = parseMoney(r["roomTotal"]);
  if (roomTotal === null) return "roomTotal must be a non-negative number";
  body.roomTotal = roomTotal;
  return null;
}

function parseUpdateCleaningFee(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  const cleaningFee = parseMoney(r["cleaningFee"]);
  if (cleaningFee === null) return "cleaningFee must be a non-negative number";
  body.cleaningFee = cleaningFee;
  return null;
}

function parseUpdateReservationNumber(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody
): string | null {
  const reservationNumber = parseNullableTrimmedStringField(
    r["reservationNumber"],
    "reservationNumber"
  );
  if (!reservationNumber.ok) return reservationNumber.error;
  body.reservationNumber = reservationNumber.value;
  return null;
}

const UPDATE_RESERVATION_FIELD_PARSERS: Record<
  TUpdateReservationField,
  TUpdateReservationFieldParser
> = {
  channelCommissionId: parseUpdateChannelCommissionId,
  checkIn: parseUpdateCheckIn,
  checkOut: parseUpdateCheckOut,
  cleaningFee: parseUpdateCleaningFee,
  guestName: parseUpdateGuestName,
  reservationNumber: parseUpdateReservationNumber,
  roomTotal: parseUpdateRoomTotal,
  status: parseUpdateStatus,
  unitId: parseUpdateUnitId,
};

function applyUpdateReservationField(
  r: Record<string, unknown>,
  body: IUpdatePropertyReservationBody,
  field: TUpdateReservationField
): string | null {
  if (!(field in r)) return null;
  return UPDATE_RESERVATION_FIELD_PARSERS[field](r, body);
}

function parseUpdateReservationBody(
  raw: unknown
): { body: IUpdatePropertyReservationBody; ok: true } | { error: string; ok: false } {
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

  const body: IUpdatePropertyReservationBody = {};
  for (const field of UPDATE_FIELDS) {
    const fieldError = applyUpdateReservationField(r, body, field);
    if (fieldError) {
      return { error: fieldError, ok: false };
    }
  }

  if (Object.keys(body).length === 0) {
    return { error: "At least one field is required", ok: false };
  }

  return { body, ok: true };
}

function parseReservationRentalTypeFilter(
  query: Record<string, unknown>,
  filters: IPropertyReservationsListQuery
): { error: string; ok: false } | { ok: true } {
  if (query["rentalType"] === undefined || query["rentalType"] === "") {
    return { ok: true };
  }
  if (typeof query["rentalType"] !== "string") {
    return { error: "rentalType must be a string", ok: false };
  }
  if (!UNIT_RENTAL_TYPES.has(query["rentalType"] as TUnitRentalType)) {
    return {
      error: `rentalType must be one of: ${[...UNIT_RENTAL_TYPES].join(", ")}`,
      ok: false,
    };
  }
  filters.rentalType = query["rentalType"] as TUnitRentalType;
  return { ok: true };
}

function parseReservationLimitFilter(
  query: Record<string, unknown>,
  filters: IPropertyReservationsListQuery
): { error: string; ok: false } | { ok: true } {
  if (query["limit"] === undefined || query["limit"] === "") {
    return { ok: true };
  }
  const rawLimit = Number(query["limit"]);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
    return { error: "limit must be an integer between 1 and 100", ok: false };
  }
  filters.limit = rawLimit;
  return { ok: true };
}

function parseReservationsListQuery(
  query: Record<string, unknown>
): { filters: IPropertyReservationsListQuery; ok: true } | { error: string; ok: false } {
  const filters: IPropertyReservationsListQuery = {};

  const filterSteps = [
    () => applyOptionalQueryDateFilter(query, "from", filters, "from must be a YYYY-MM-DD date"),
    () => applyOptionalQueryDateFilter(query, "to", filters, "to must be a YYYY-MM-DD date"),
    () =>
      applyOptionalQueryDateFilter(
        query,
        "checkOutFrom",
        filters,
        "checkOutFrom must be a YYYY-MM-DD date"
      ),
    () =>
      applyOptionalQueryDateFilter(
        query,
        "checkInTo",
        filters,
        "checkInTo must be a YYYY-MM-DD date"
      ),
    () => applyOptionalQueryUuidFilter(query, "unitId", filters, "unitId must be a valid UUID"),
    () =>
      applyOptionalQueryUuidFilter(
        query,
        "includeReservationId",
        filters,
        "includeReservationId must be a valid UUID"
      ),
    () => parseReservationRentalTypeFilter(query, filters),
    () => parseReservationLimitFilter(query, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) return result;
  }

  if (query["channelCommissionId"] !== undefined && query["channelCommissionId"] !== "") {
    const channelCommissionId = parseReservationChannelCommissionId(query["channelCommissionId"]);
    if (channelCommissionId === null) {
      return {
        error: "channelCommissionId must be a valid UUID",
        ok: false,
      };
    }
    filters.channelCommissionId = channelCommissionId;
  }

  if (query["status"] !== undefined && query["status"] !== "") {
    const status = parseReservationStatus(query["status"]);
    if (status === null) {
      return {
        error: `status must be one of: ${[...RESERVATION_STATUSES].join(", ")}`,
        ok: false,
      };
    }
    filters.status = status;
  }

  return { filters, ok: true };
}

interface IPropertyParams {
  propertyId: string;
}

interface IPropertyShortStayParams {
  propertyId: string;
  shortStayId: string;
}

async function resolveRentableUnitForProperty(
  unitId: string,
  propertyId: string,
  reply: FastifyReply
) {
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

async function buildComputedFields(
  propertyId: string,
  input: {
    channelCommissionId: string;
    checkIn: string;
    checkOut: string;
    cleaningFee: number;
    roomTotal: number;
    unitId: string;
  },
  reply: FastifyReply,
  options?: { requireShortTermUnit?: boolean }
) {
  const unit = await resolveRentableUnitForProperty(input.unitId, propertyId, reply);
  if (!unit) return null;

  if (options?.requireShortTermUnit && unit.rentalType !== UnitRentalType.SHORT_TERM) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Reservations can only be created for short-term units" });
    return null;
  }

  const channelCommission = await propertyChannelCommissionsDb.findByIdForProperty(
    input.channelCommissionId,
    propertyId
  );
  if (!channelCommission) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: "Channel not found for this property" });
    return null;
  }

  let nights: number;
  try {
    nights = calculateNights(input.checkIn, input.checkOut);
  } catch (e) {
    void reply
      .status(HttpStatus.BAD_REQUEST)
      .send({ error: e instanceof Error ? e.message : "Invalid stay dates" });
    return null;
  }

  const settings = await propertySettingsDb.getOrCreateDefaults(propertyId);
  const income = calculateStayIncome({
    channelCommission,
    cleaningFee: input.cleaningFee,
    nights,
    roomTotal: input.roomTotal,
    taxRates: settings.taxRates,
    unitRentalType: unit.rentalType,
  });

  return { ...income, nights };
}

function mergeReservationInput(
  existing: IPropertyReservation,
  patch: IUpdatePropertyReservationBody
): ICreatePropertyReservationBody {
  return {
    channelCommissionId: patch.channelCommissionId ?? existing.channelCommissionId,
    checkIn: patch.checkIn ?? existing.checkIn,
    checkOut: patch.checkOut ?? existing.checkOut,
    cleaningFee: patch.cleaningFee ?? existing.cleaningFee,
    guestName: patch.guestName ?? existing.guestName,
    reservationNumber:
      patch.reservationNumber === undefined
        ? (existing.reservationNumber ?? undefined)
        : (patch.reservationNumber ?? undefined),
    roomTotal: patch.roomTotal ?? existing.roomTotal,
    status: patch.status ?? existing.status,
    unitId: patch.unitId ?? existing.unitId,
  };
}

export const propertyReservationRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/short-stays",
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

      const parsed = parseReservationsListQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const includeDeleted = request.user.userType === UserType.ADMIN;
      const shortStays = await propertyReservationsDb.findByProperty(
        propertyId,
        parsed.filters,
        includeDeleted
      );
      return reply.send({ shortStays });
    }
  );

  server.post<{ Params: IPropertyParams }>(
    "/properties/:propertyId/short-stays",
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

      const parsed = parseCreateReservationBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const computed = await buildComputedFields(propertyId, parsed.body, reply, {
        requireShortTermUnit: true,
      });
      if (!computed) return;

      const shortStay = await propertyReservationsDb.create(propertyId, parsed.body, computed);
      return reply.status(HttpStatus.CREATED).send({ shortStay });
    }
  );

  server.patch<{ Params: IPropertyShortStayParams }>(
    "/properties/:propertyId/short-stays/:shortStayId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyShortStayParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const shortStayId = parseUuidParam(request.params.shortStayId);
      if (shortStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid shortStayId" });
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

      const existing = await propertyReservationsDb.findById(shortStayId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Short stay not found" });
      }

      if (rejectIfDeleted(existing, reply, "short stay")) return;
      if (rejectIfRefunded(existing, reply, "short stay")) return;

      const parsed = parseUpdateReservationBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const merged = mergeReservationInput(existing, parsed.body);
      const computed = await buildComputedFields(propertyId, merged, reply);
      if (!computed) return;

      const shortStay = await propertyReservationsDb.update(shortStayId, parsed.body, computed);
      return reply.send({ shortStay });
    }
  );

  server.delete<{ Params: IPropertyShortStayParams }>(
    "/properties/:propertyId/short-stays/:shortStayId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyShortStayParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const shortStayId = parseUuidParam(request.params.shortStayId);
      if (shortStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid shortStayId" });
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

      const existing = await propertyReservationsDb.findById(shortStayId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Short stay not found" });
      }

      if (rejectIfDeleted(existing, reply, "short stay")) return;

      await propertyReservationsDb.softDelete(shortStayId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );

  server.post<{ Params: IPropertyShortStayParams }>(
    "/properties/:propertyId/short-stays/:shortStayId/restore",
    { preHandler: [server.authenticate, server.requireAdmin] },
    async (request: FastifyRequest<{ Params: IPropertyShortStayParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const shortStayId = parseUuidParam(request.params.shortStayId);
      if (shortStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid shortStayId" });
      }

      const existing = await propertyReservationsDb.findById(shortStayId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Short stay not found" });
      }

      await propertyReservationsDb.restore(shortStayId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );

  server.post<{ Params: IPropertyShortStayParams }>(
    "/properties/:propertyId/short-stays/:shortStayId/refund",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyShortStayParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const shortStayId = parseUuidParam(request.params.shortStayId);
      if (shortStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid shortStayId" });
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

      const existing = await propertyReservationsDb.findById(shortStayId);
      await executeLedgerRefund(reply, {
        db: propertyReservationsDb,
        entity: existing,
        entityId: shortStayId,
        entityName: "Short stay",
        label: "short stay",
        notFoundError: "Short stay not found",
        propertyId,
        userId: request.user.userId,
      });
    }
  );

  server.post<{ Params: IPropertyShortStayParams }>(
    "/properties/:propertyId/short-stays/:shortStayId/unrefund",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyShortStayParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const shortStayId = parseUuidParam(request.params.shortStayId);
      if (shortStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid shortStayId" });
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

      const existing = await propertyReservationsDb.findById(shortStayId);
      await executeLedgerUnrefund(reply, {
        db: propertyReservationsDb,
        entity: existing,
        entityId: shortStayId,
        entityName: "Short stay",
        notFoundError: "Short stay not found",
        propertyId,
      });
    }
  );
};
