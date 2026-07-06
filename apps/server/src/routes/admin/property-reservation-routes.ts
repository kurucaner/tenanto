import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyReservationsDb } from "@/db/property-reservations";
import { propertySettingsDb } from "@/db/property-settings";
import { propertyUnitsDb } from "@/db/property-units";
import {
  HttpStatus,
  type ICreatePropertyReservationBody,
  type IPropertyReservation,
  type IPropertyReservationsListQuery,
  type IUpdatePropertyReservationBody,
  ReservationChannel,
  ReservationStatus,
  type TReservationChannel,
  type TReservationStatus,
  type TUnitRentalType,
  UnitRentalType,
} from "@/packages/shared";
import {
  calculateNights,
  calculateStayIncome,
} from "@/services/property-income-calculator";

import { parseOptionalUuid, parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyMemberAccess,
  assertPropertyOwnerAccess,
} from "./property-route-access";

const RESERVATION_STATUSES = new Set<TReservationStatus>(Object.values(ReservationStatus));
const RESERVATION_CHANNELS = new Set<TReservationChannel>(Object.values(ReservationChannel));
const UNIT_RENTAL_TYPES = new Set<TUnitRentalType>(Object.values(UnitRentalType));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateString(raw: unknown): string | null {
  if (typeof raw !== "string" || !DATE_RE.test(raw.trim())) return null;
  const date = Date.parse(`${raw.trim()}T00:00:00Z`);
  if (!Number.isFinite(date)) return null;
  return raw.trim();
}

function parseReservationStatus(raw: unknown): TReservationStatus | null {
  if (typeof raw !== "string") return null;
  return RESERVATION_STATUSES.has(raw as TReservationStatus)
    ? (raw as TReservationStatus)
    : null;
}

function parseReservationChannel(raw: unknown): TReservationChannel | null {
  if (typeof raw !== "string") return null;
  return RESERVATION_CHANNELS.has(raw as TReservationChannel)
    ? (raw as TReservationChannel)
    : null;
}

function parseMoney(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
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

  const channel = parseReservationChannel(r["channel"]);
  if (channel === null) {
    return {
      error: `channel must be one of: ${[...RESERVATION_CHANNELS].join(", ")}`,
      ok: false,
    };
  }

  const roomRate = parseMoney(r["roomRate"]);
  if (roomRate === null) return { error: "roomRate must be a non-negative number", ok: false };

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
      channel,
      checkIn,
      checkOut,
      cleaningFee,
      guestName: r["guestName"].trim(),
      reservationNumber,
      roomRate,
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
  "channel",
  "roomRate",
  "cleaningFee",
] as const;

function parseUpdateReservationBody(
  raw: unknown
): { body: IUpdatePropertyReservationBody; ok: true } | { error: string; ok: false } {
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

  const body: IUpdatePropertyReservationBody = {};

  if ("guestName" in r) {
    if (typeof r["guestName"] !== "string" || r["guestName"].trim() === "") {
      return { error: "guestName must be a non-empty string", ok: false };
    }
    body.guestName = r["guestName"].trim();
  }
  if ("unitId" in r) {
    const unitId = parseUuidParam(r["unitId"]);
    if (unitId === null) return { error: "unitId must be a valid UUID", ok: false };
    body.unitId = unitId;
  }
  if ("checkIn" in r) {
    const checkIn = parseDateString(r["checkIn"]);
    if (!checkIn) return { error: "checkIn must be a YYYY-MM-DD date", ok: false };
    body.checkIn = checkIn;
  }
  if ("checkOut" in r) {
    const checkOut = parseDateString(r["checkOut"]);
    if (!checkOut) return { error: "checkOut must be a YYYY-MM-DD date", ok: false };
    body.checkOut = checkOut;
  }
  if ("status" in r) {
    const status = parseReservationStatus(r["status"]);
    if (status === null) {
      return {
        error: `status must be one of: ${[...RESERVATION_STATUSES].join(", ")}`,
        ok: false,
      };
    }
    body.status = status;
  }
  if ("channel" in r) {
    const channel = parseReservationChannel(r["channel"]);
    if (channel === null) {
      return {
        error: `channel must be one of: ${[...RESERVATION_CHANNELS].join(", ")}`,
        ok: false,
      };
    }
    body.channel = channel;
  }
  if ("roomRate" in r) {
    const roomRate = parseMoney(r["roomRate"]);
    if (roomRate === null) return { error: "roomRate must be a non-negative number", ok: false };
    body.roomRate = roomRate;
  }
  if ("cleaningFee" in r) {
    const cleaningFee = parseMoney(r["cleaningFee"]);
    if (cleaningFee === null) {
      return { error: "cleaningFee must be a non-negative number", ok: false };
    }
    body.cleaningFee = cleaningFee;
  }
  if ("reservationNumber" in r) {
    if (r["reservationNumber"] === null) {
      body.reservationNumber = null;
    } else if (typeof r["reservationNumber"] === "string") {
      body.reservationNumber = r["reservationNumber"].trim();
    } else {
      return { error: "reservationNumber must be a string or null", ok: false };
    }
  }

  if (Object.keys(body).length === 0) {
    return { error: "At least one field is required", ok: false };
  }

  return { body, ok: true };
}

function parseReservationsListQuery(
  query: Record<string, unknown>
): { filters: IPropertyReservationsListQuery; ok: true } | { error: string; ok: false } {
  const filters: IPropertyReservationsListQuery = {};

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
  if (query["channel"] !== undefined && query["channel"] !== "") {
    const channel = parseReservationChannel(query["channel"]);
    if (channel === null) {
      return {
        error: `channel must be one of: ${[...RESERVATION_CHANNELS].join(", ")}`,
        ok: false,
      };
    }
    filters.channel = channel;
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
  if (query["rentalType"] !== undefined && query["rentalType"] !== "") {
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
  }

  return { filters, ok: true };
}

interface IPropertyParams {
  propertyId: string;
}

interface IPropertyReservationParams {
  propertyId: string;
  reservationId: string;
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

async function buildComputedFields(
  propertyId: string,
  input: {
    channel: TReservationChannel;
    checkIn: string;
    checkOut: string;
    cleaningFee: number;
    roomRate: number;
    unitId: string;
  },
  reply: FastifyReply
) {
  const unit = await resolveUnitForProperty(input.unitId, propertyId, reply);
  if (!unit) return null;

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
    channel: input.channel,
    cleaningFee: input.cleaningFee,
    roomRate: input.roomRate,
    settings,
    unitRentalType: unit.rentalType,
  });

  return { ...income, nights };
}

function mergeReservationInput(
  existing: IPropertyReservation,
  patch: IUpdatePropertyReservationBody
): ICreatePropertyReservationBody {
  return {
    channel: patch.channel ?? existing.channel,
    checkIn: patch.checkIn ?? existing.checkIn,
    checkOut: patch.checkOut ?? existing.checkOut,
    cleaningFee: patch.cleaningFee ?? existing.cleaningFee,
    guestName: patch.guestName ?? existing.guestName,
    reservationNumber:
      patch.reservationNumber === undefined
        ? (existing.reservationNumber ?? undefined)
        : (patch.reservationNumber ?? undefined),
    roomRate: patch.roomRate ?? existing.roomRate,
    status: patch.status ?? existing.status,
    unitId: patch.unitId ?? existing.unitId,
  };
}

export const propertyReservationRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/reservations",
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

      const reservations = await propertyReservationsDb.findByProperty(propertyId, parsed.filters);
      return reply.send({ reservations });
    }
  );

  server.post<{ Params: IPropertyParams }>(
    "/properties/:propertyId/reservations",
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

      const isOwner = await assertPropertyOwnerAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage income entries"
      );
      if (!isOwner) return;

      const parsed = parseCreateReservationBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const computed = await buildComputedFields(propertyId, parsed.body, reply);
      if (!computed) return;

      const reservation = await propertyReservationsDb.create(
        propertyId,
        parsed.body,
        computed
      );
      return reply.status(HttpStatus.CREATED).send({ reservation });
    }
  );

  server.patch<{ Params: IPropertyReservationParams }>(
    "/properties/:propertyId/reservations/:reservationId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyReservationParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const reservationId = parseUuidParam(request.params.reservationId);
      if (reservationId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid reservationId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const isOwner = await assertPropertyOwnerAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage income entries"
      );
      if (!isOwner) return;

      const existing = await propertyReservationsDb.findById(reservationId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Reservation not found" });
      }

      const parsed = parseUpdateReservationBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const merged = mergeReservationInput(existing, parsed.body);
      const computed = await buildComputedFields(propertyId, merged, reply);
      if (!computed) return;

      const reservation = await propertyReservationsDb.update(
        reservationId,
        parsed.body,
        computed
      );
      return reply.send({ reservation });
    }
  );

  server.delete<{ Params: IPropertyReservationParams }>(
    "/properties/:propertyId/reservations/:reservationId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: IPropertyReservationParams }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const reservationId = parseUuidParam(request.params.reservationId);
      if (reservationId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid reservationId" });
      }

      const hasAccess = await assertPropertyMemberAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply
      );
      if (!hasAccess) return;

      const isOwner = await assertPropertyOwnerAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can manage income entries"
      );
      if (!isOwner) return;

      const existing = await propertyReservationsDb.findById(reservationId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Reservation not found" });
      }

      await propertyReservationsDb.delete(reservationId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
