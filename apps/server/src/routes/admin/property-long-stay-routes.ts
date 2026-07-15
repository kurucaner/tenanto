import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  ActiveLongStayConflictError,
  InvalidExtendLeaseError,
  LongStayNotActiveError,
  LongStayNotFoundError,
  propertyLongStaysDb,
} from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import {
  HttpStatus,
  type ICreatePropertyLongStayBody,
  type IEndPropertyLongStayBody,
  type IExtendPropertyLongStayBody,
  type IPropertyLongStaySecondaryTenant,
  type IUpdatePropertyLongStayBody,
  LEASES_LIST_LIMIT,
  LEASES_LIST_MAX_LIMIT,
  LEASES_SORT_BY_VALUES,
  LEASES_SORT_DIR_VALUES,
  MAX_ADDITIONAL_TERM_MONTHS,
  PropertyLongStayStatus,
  type TPropertyLongStaysListFilters,
  type TPropertyLongStaysListSortBy,
  type TPropertyLongStaysListSortDir,
  type TPropertyLongStayStatus,
  UnitRentalType,
  validateEndLeaseMoveOutDate,
} from "@/packages/shared";
import { decodeLeaseKeysetCursor } from "@/pagination/keyset-cursor";

import { parseUuidParam } from "./admin-query-utils";
import { parseJsonObject } from "./parse-body-utils";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQuerySearchFilter,
  applyOptionalQueryUuidFilter,
} from "./parse-list-query-filters";
import { parseNullablePhoneNumber, parseOptionalPhoneNumber } from "./phone-body-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_TERM_MONTHS = 60;
const MAX_SECONDARY_TENANTS = 10;

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

  const tenantPhoneResult = parseOptionalPhoneNumber(r["tenantPhone"], "tenantPhone");
  if (!tenantPhoneResult.ok) {
    return tenantPhoneResult;
  }

  return {
    body: {
      guestName: r["guestName"].trim(),
      leaseStartDate,
      monthlyRent,
      tenantEmail: tenantEmail ?? undefined,
      tenantPhone: tenantPhoneResult.phoneNumber,
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

function parsePositiveMoney(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function parseExtendLongStayBody(
  raw: unknown
): { body: IExtendPropertyLongStayBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;

  const additionalTermMonths = parseTermMonths(r["additionalTermMonths"]);
  if (additionalTermMonths === null) {
    return {
      error: `additionalTermMonths must be a whole number between 1 and ${MAX_ADDITIONAL_TERM_MONTHS}`,
      ok: false,
    };
  }

  const body: IExtendPropertyLongStayBody = { additionalTermMonths };

  const hasNewRent = "newMonthlyRent" in r;
  const hasEffectiveMonth = "rentEffectiveFromMonth" in r;

  if (hasNewRent !== hasEffectiveMonth) {
    return {
      error: "newMonthlyRent and rentEffectiveFromMonth must both be provided when changing rent",
      ok: false,
    };
  }

  if (hasNewRent) {
    const newMonthlyRent = parsePositiveMoney(r["newMonthlyRent"]);
    if (newMonthlyRent === null) {
      return { error: "newMonthlyRent must be a positive number", ok: false };
    }

    if (
      typeof r["rentEffectiveFromMonth"] !== "string" ||
      !MONTH_RE.test(r["rentEffectiveFromMonth"])
    ) {
      return { error: "rentEffectiveFromMonth must be YYYY-MM format", ok: false };
    }

    body.newMonthlyRent = newMonthlyRent;
    body.rentEffectiveFromMonth = r["rentEffectiveFromMonth"];
  }

  return { body, ok: true };
}

function parseSecondaryTenant(
  raw: unknown
): { ok: true; tenant: IPropertyLongStaySecondaryTenant } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Each secondary tenant must have a non-empty name", ok: false };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r["name"] !== "string" || r["name"].trim() === "") {
    return { error: "Each secondary tenant must have a non-empty name", ok: false };
  }

  const email = parseOptionalString(r["email"]);
  if (r["email"] !== undefined && r["email"] !== null && email === null) {
    return { error: "Each secondary tenant email must be a string", ok: false };
  }

  const phoneResult = parseNullablePhoneNumber(r["phone"], "phone");
  if (!phoneResult.ok) {
    return phoneResult;
  }

  return {
    ok: true,
    tenant: {
      email,
      name: r["name"].trim(),
      phone: phoneResult.phoneNumber,
    },
  };
}

function parseNullableContactField(
  raw: unknown,
  fieldName: string
): { ok: true; value: string | null } | { error: string; ok: false } {
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { error: `${fieldName} must be a string or null`, ok: false };
  }
  const trimmed = raw.trim();
  return { ok: true, value: trimmed === "" ? null : trimmed };
}

function parseUpdateLongStayBody(
  raw: unknown
): { body: IUpdatePropertyLongStayBody; ok: true } | { error: string; ok: false } {
  const r = parseJsonObject(raw);
  if (!r) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const body: IUpdatePropertyLongStayBody = {};
  const guestNameError = applyUpdateLongStayGuestName(r, body);
  if (guestNameError) return { error: guestNameError, ok: false };

  const tenantEmailError = applyUpdateLongStayTenantEmail(r, body);
  if (tenantEmailError) return tenantEmailError;

  const tenantPhoneError = applyUpdateLongStayTenantPhone(r, body);
  if (tenantPhoneError) return tenantPhoneError;

  const secondaryTenantsError = applyUpdateLongStaySecondaryTenants(r, body);
  if (secondaryTenantsError) return secondaryTenantsError;

  if (Object.keys(body).length === 0) {
    return { error: "At least one updatable field is required", ok: false };
  }

  return { body, ok: true };
}

function applyUpdateLongStayGuestName(
  r: Record<string, unknown>,
  body: IUpdatePropertyLongStayBody
): string | null {
  if (!("guestName" in r)) return null;
  if (typeof r["guestName"] !== "string" || r["guestName"].trim() === "") {
    return "guestName must be a non-empty string";
  }
  body.guestName = r["guestName"].trim();
  return null;
}

function applyUpdateLongStayTenantEmail(
  r: Record<string, unknown>,
  body: IUpdatePropertyLongStayBody
): { error: string; ok: false } | null {
  if (!("tenantEmail" in r)) return null;
  const parsedEmail = parseNullableContactField(r["tenantEmail"], "tenantEmail");
  if (!parsedEmail.ok) return parsedEmail;
  body.tenantEmail = parsedEmail.value;
  return null;
}

function applyUpdateLongStayTenantPhone(
  r: Record<string, unknown>,
  body: IUpdatePropertyLongStayBody
): { error: string; ok: false } | null {
  if (!("tenantPhone" in r)) return null;
  const parsedPhone = parseNullablePhoneNumber(r["tenantPhone"], "tenantPhone");
  if (!parsedPhone.ok) return parsedPhone;
  body.tenantPhone = parsedPhone.phoneNumber;
  return null;
}

function applyUpdateLongStaySecondaryTenants(
  r: Record<string, unknown>,
  body: IUpdatePropertyLongStayBody
): { error: string; ok: false } | null {
  if (!("secondaryTenants" in r)) return null;
  if (!Array.isArray(r["secondaryTenants"])) {
    return { error: "secondaryTenants must be an array", ok: false };
  }
  if (r["secondaryTenants"].length > MAX_SECONDARY_TENANTS) {
    return {
      error: `secondaryTenants cannot exceed ${MAX_SECONDARY_TENANTS} items`,
      ok: false,
    };
  }

  const secondaryTenants: IPropertyLongStaySecondaryTenant[] = [];
  for (const item of r["secondaryTenants"]) {
    const tenantResult = parseSecondaryTenant(item);
    if (!tenantResult.ok) return tenantResult;
    secondaryTenants.push(tenantResult.tenant);
  }
  body.secondaryTenants = secondaryTenants;
  return null;
}

function parseLongStaysListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return LEASES_LIST_LIMIT;
  return Math.min(LEASES_LIST_MAX_LIMIT, Math.floor(n));
}

function parseLongStaysListSortBy(value: unknown): TPropertyLongStaysListSortBy | "" | null {
  if (value === undefined || value === "") {
    return "";
  }
  if (typeof value !== "string") {
    return null;
  }
  if ((LEASES_SORT_BY_VALUES as readonly string[]).includes(value)) {
    return value as TPropertyLongStaysListSortBy;
  }
  return null;
}

function parseLongStaysListSortDir(value: unknown): TPropertyLongStaysListSortDir | "" | null {
  if (value === undefined || value === "") {
    return "";
  }
  if (typeof value !== "string") {
    return null;
  }
  if ((LEASES_SORT_DIR_VALUES as readonly string[]).includes(value)) {
    return value as TPropertyLongStaysListSortDir;
  }
  return null;
}

function parseLongStaysListQuery(query: Record<string, unknown>):
  | {
      cursor?: string;
      filters: TPropertyLongStaysListFilters;
      limit: number;
      ok: true;
    }
  | { error: string; ok: false } {
  const filters: TPropertyLongStaysListFilters = {};

  const filterSteps = [
    () => applyOptionalQueryDateFilter(query, "from", filters, "from must be a YYYY-MM-DD date"),
    () => applyOptionalQueryDateFilter(query, "to", filters, "to must be a YYYY-MM-DD date"),
    () => applyOptionalQueryUuidFilter(query, "unitId", filters, "unitId must be a valid UUID"),
    () => applyOptionalQuerySearchFilter(query, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) return result;
  }

  if (query["status"] !== undefined && query["status"] !== "") {
    const status = query["status"];
    if (status !== PropertyLongStayStatus.ACTIVE && status !== PropertyLongStayStatus.ENDED) {
      return { error: "status must be active or ended", ok: false };
    }
    filters.status = status as TPropertyLongStayStatus;
  }

  const sortBy = parseLongStaysListSortBy(query["sortBy"]);
  if (sortBy === null) {
    return {
      error: `sortBy must be one of: ${LEASES_SORT_BY_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (sortBy) {
    filters.sortBy = sortBy;
  }

  const sortDir = parseLongStaysListSortDir(query["sortDir"]);
  if (sortDir === null) {
    return {
      error: `sortDir must be one of: ${LEASES_SORT_DIR_VALUES.join(", ")}`,
      ok: false,
    };
  }
  if (sortDir) {
    filters.sortDir = sortDir;
  }

  const limit = parseLongStaysListLimit(query["limit"]);
  const cursor =
    typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

  return { cursor, filters, limit, ok: true };
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

      if (parsed.cursor != null) {
        try {
          decodeLeaseKeysetCursor(parsed.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const { longStays, meta, nextCursor } = await propertyLongStaysDb.listPaginatedByProperty(
        propertyId,
        parsed.filters,
        { cursor: parsed.cursor, limit: parsed.limit }
      );
      return reply.send(meta ? { longStays, meta, nextCursor } : { longStays, nextCursor });
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
      const rentPeriods = await propertyLongStaysDb.listRentPeriods(longStayId);
      return reply.send({ longStay, rentPeriods, rentSchedule });
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

  server.patch<{ Params: IPropertyLongStayParams }>(
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

      const parsed = parseUpdateLongStayBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      try {
        const longStay = await propertyLongStaysDb.updateLease(longStayId, parsed.body);
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
      const moveOutDateError = validateEndLeaseMoveOutDate(
        parsed.body.actualEndDate,
        existing.leaseStartDate,
        existing.leaseEndDate,
        today
      );
      if (moveOutDateError) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: moveOutDateError });
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

  server.post<{ Params: IPropertyLongStayParams }>(
    "/properties/:propertyId/long-stays/:longStayId/extend",
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

      const parsed = parseExtendLongStayBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      try {
        const longStay = await propertyLongStaysDb.extendLease(longStayId, parsed.body);
        return reply.send({ longStay });
      } catch (error) {
        if (error instanceof InvalidExtendLeaseError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
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
