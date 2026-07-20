import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { isIdentityConflictError } from "@/constants/account";
import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { getTodayUtcIsoDate } from "@/lib/date-utils";
import {
  HttpStatus,
  type ICreatePropertyLongStayBody,
  type IEditPropertyLongStayTermsBody,
  type IEndPropertyLongStayBody,
  type IExtendPropertyLongStayBody,
  type IUpdatePropertyLongStayBody,
  MAX_ADDITIONAL_TERM_MONTHS,
  UnitRentalType,
  validateEndLeaseMoveOutDate,
  validateLeaseTermInput,
} from "@/packages/shared";
import { replyFromDomainError } from "@/routes/reply-from-domain-error";
import { notifyPrimaryTenantLeaseEnded } from "@/services/lease-notifications";
import { resolvePrimaryTenantContactForLongStay } from "@/services/lease-primary-tenant-contact-service";
import { editLeaseTerms, getLeaseTermsEditability } from "@/services/lease-terms-edit-service";
import { resolveSecondaryTenantContactsForLongStay } from "@/services/resolve-secondary-tenant-contacts-service";
import { tenantPortalInviteService } from "@/services/tenant-portal-invite-service";
import { logTenantPortalMembershipsEnded } from "@/services/tenant-portal-observability";
import { updatePrimaryTenantContact } from "@/services/update-primary-tenant-contact-service";

import { parseDateString, parseUuidParam } from "./admin-query-utils";
import { parseJsonObject, parseMoney } from "./parse-body-utils";
import { buildPaginatedListResponse } from "./parse-list-query-pagination";
import { parsePropertyLongStaysListQuery } from "./parse-property-long-stays-list-query";
import { parseNullablePhoneNumber, parseOptionalPhoneNumber } from "./phone-body-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
  requirePropertyMemberAccess,
} from "./property-route-access";
import { type IPropertyParams } from "./property-route-params";
import { resolvePropertyUnit } from "./resolve-property-unit";

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_TERM_MONTHS = 60;

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

function parseLeaseTermFields(
  r: Record<string, unknown>
):
  | {
      body: Pick<ICreatePropertyLongStayBody, "leaseEndDate" | "leaseStartDate" | "termMonths">;
      ok: true;
    }
  | { error: string; ok: false } {
  const leaseStartDate = parseDateString(r["leaseStartDate"]);
  if (!leaseStartDate) {
    return { error: "leaseStartDate must be a YYYY-MM-DD date", ok: false };
  }

  const hasLeaseEndDate =
    "leaseEndDate" in r &&
    r["leaseEndDate"] !== undefined &&
    r["leaseEndDate"] !== null &&
    r["leaseEndDate"] !== "";
  const hasTermMonths = "termMonths" in r && r["termMonths"] !== undefined && r["termMonths"] !== null;

  let leaseEndDate: string | undefined;
  if (hasLeaseEndDate) {
    const parsedLeaseEndDate = parseDateString(r["leaseEndDate"]);
    if (!parsedLeaseEndDate) {
      return { error: "leaseEndDate must be a YYYY-MM-DD date", ok: false };
    }
    leaseEndDate = parsedLeaseEndDate;
  }

  let termMonths: number | undefined;
  if (hasTermMonths) {
    const parsedTermMonths = parseTermMonths(r["termMonths"]);
    if (parsedTermMonths === null) {
      return {
        error: `termMonths must be a whole number between 1 and ${MAX_TERM_MONTHS}`,
        ok: false,
      };
    }
    termMonths = parsedTermMonths;
  }

  const validationError = validateLeaseTermInput({
    leaseEndDate,
    leaseStartDate,
    termMonths,
  });
  if (validationError) {
    return { error: validationError, ok: false };
  }

  return {
    body: {
      leaseEndDate,
      leaseStartDate,
      termMonths,
    },
    ok: true,
  };
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

  const leaseTermFields = parseLeaseTermFields(r);
  if (!leaseTermFields.ok) {
    return leaseTermFields;
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
      ...leaseTermFields.body,
      monthlyRent,
      tenantEmail: tenantEmail ?? undefined,
      tenantPhone: tenantPhoneResult.phoneNumber,
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

function parseEditLeaseTermsBody(
  raw: unknown
): { body: IEditPropertyLongStayTermsBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;

  const leaseTermFields = parseLeaseTermFields(r);
  if (!leaseTermFields.ok) {
    return leaseTermFields;
  }

  const monthlyRent = parseMoney(r["monthlyRent"]);
  if (monthlyRent === null) {
    return { error: "monthlyRent must be a non-negative number", ok: false };
  }

  return {
    body: {
      ...leaseTermFields.body,
      monthlyRent,
    },
    ok: true,
  };
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

  const hasCustomEnd =
    "newLeaseEndDate" in r &&
    r["newLeaseEndDate"] !== undefined &&
    r["newLeaseEndDate"] !== null &&
    r["newLeaseEndDate"] !== "";
  const hasAdditionalMonths =
    "additionalTermMonths" in r &&
    r["additionalTermMonths"] !== undefined &&
    r["additionalTermMonths"] !== null;

  if (hasCustomEnd === hasAdditionalMonths) {
    return {
      error: "Provide additionalTermMonths or newLeaseEndDate, but not both",
      ok: false,
    };
  }

  const body: IExtendPropertyLongStayBody = {};

  if (hasCustomEnd) {
    const newLeaseEndDate = parseDateString(r["newLeaseEndDate"]);
    if (!newLeaseEndDate) {
      return { error: "newLeaseEndDate must be a YYYY-MM-DD date", ok: false };
    }
    body.newLeaseEndDate = newLeaseEndDate;
  } else {
    const additionalTermMonths = parseTermMonths(r["additionalTermMonths"]);
    if (additionalTermMonths === null) {
      return {
        error: `additionalTermMonths must be a whole number between 1 and ${MAX_ADDITIONAL_TERM_MONTHS}`,
        ok: false,
      };
    }
    body.additionalTermMonths = additionalTermMonths;
  }

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

function applyUpdateLongStaySecondaryTenants(
  r: Record<string, unknown>
): { error: string; ok: false } | null {
  if (!("secondaryTenants" in r)) return null;
  return {
    error:
      "secondaryTenants is no longer supported; use /secondary-occupants to manage secondary tenants",
    ok: false,
  };
}

function parseUpdateLongStayBody(
  raw: unknown
): { body: IUpdatePropertyLongStayBody; ok: true } | { error: string; ok: false } {
  const r = parseJsonObject(raw);
  if (!r) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const secondaryTenantsError = applyUpdateLongStaySecondaryTenants(r);
  if (secondaryTenantsError) return secondaryTenantsError;

  const body: IUpdatePropertyLongStayBody = {};
  const guestNameError = applyUpdateLongStayGuestName(r, body);
  if (guestNameError) return { error: guestNameError, ok: false };

  const tenantEmailError = applyUpdateLongStayTenantEmail(r, body);
  if (tenantEmailError) return tenantEmailError;

  const tenantPhoneError = applyUpdateLongStayTenantPhone(r, body);
  if (tenantPhoneError) return tenantPhoneError;

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

interface IPropertyLongStayParams {
  longStayId: string;
  propertyId: string;
}

function handleLeaseDomainError(error: unknown, reply: FastifyReply): FastifyReply {
  if (replyFromDomainError(reply, error)) {
    return reply;
  }
  throw error;
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
      const propertyId = await requirePropertyMemberAccess(request, reply);
      if (propertyId === null) return;

      const parsed = parsePropertyLongStaysListQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const { longStays, meta, nextCursor } = await propertyLongStaysDb.listPaginatedByProperty(
        propertyId,
        parsed.filters,
        { cursor: parsed.cursor, limit: parsed.limit }
      );
      return reply.send(
        buildPaginatedListResponse("longStays", longStays, meta, nextCursor ?? undefined)
      );
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
      const primaryTenantContact = await resolvePrimaryTenantContactForLongStay(longStay);
      const secondaryTenantContacts = await resolveSecondaryTenantContactsForLongStay(longStay);
      const termsEditability = await getLeaseTermsEditability(longStayId);
      return reply.send({
        longStay,
        primaryTenantContact,
        rentPeriods,
        rentSchedule,
        secondaryTenantContacts,
        termsEditability: termsEditability ?? { editable: false },
      });
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

      const unit = await resolvePropertyUnit(parsed.body.unitId, propertyId, reply, {
        rentalType: UnitRentalType.LONG_TERM,
        rentalTypeError: "Long stays can only be created for long-term units",
      });
      if (!unit) return;

      try {
        const longStay = await propertyLongStaysDb.create(propertyId, parsed.body);
        const portalInvite = await tenantPortalInviteService.autoInvitePrimaryOnLeaseCreate({
          invitedBy: request.user.userId,
          lease: longStay,
          propertyId,
        });
        return reply.status(HttpStatus.CREATED).send({
          longStay,
          ...(portalInvite ? { portalInvite } : {}),
        });
      } catch (error) {
        return handleLeaseDomainError(error, reply);
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
        const { guestName, tenantEmail, tenantPhone } = parsed.body;
        const longStay = await updatePrimaryTenantContact(existing, {
          guestName,
          tenantEmail,
          tenantPhone,
        });

        return reply.send({ longStay });
      } catch (error) {
        if (isIdentityConflictError(error)) {
          return reply.status(HttpStatus.CONFLICT).send({ code: error.code, error: error.message });
        }
        return handleLeaseDomainError(error, reply);
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

        const endedMemberships =
          await leaseTenantMembershipsDb.endAllNonTerminalForLease(longStayId);
        logTenantPortalMembershipsEnded(endedMemberships);

        void notifyPrimaryTenantLeaseEnded({ longStayId, propertyId }).catch((err) => {
          request.log.error({ err, longStayId, propertyId }, "Failed to send lease ended email");
        });

        return reply.send({ longStay });
      } catch (error) {
        return handleLeaseDomainError(error, reply);
      }
    }
  );

  server.patch<{ Params: IPropertyLongStayParams }>(
    "/properties/:propertyId/long-stays/:longStayId/terms",
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

      const parsed = parseEditLeaseTermsBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      try {
        const longStay = await editLeaseTerms(longStayId, parsed.body);
        return reply.send({ longStay });
      } catch (error) {
        return handleLeaseDomainError(error, reply);
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
        return handleLeaseDomainError(error, reply);
      }
    }
  );
};
