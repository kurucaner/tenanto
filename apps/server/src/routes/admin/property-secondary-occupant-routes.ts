import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  MaxSecondaryOccupantsError,
  SecondaryOccupantNotFoundError,
} from "@/db/lease-tenant-memberships";
import { LongStayNotActiveError, propertyLongStaysDb } from "@/db/property-long-stays";
import { isDuplicatePortalInviteError } from "@/errors/portal-invite-errors";
import {
  HttpStatus,
  ICreateSecondaryOccupantBody,
  isValidTenantEmail,
  IUpdateSecondaryOccupantBody,
} from "@/packages/shared";
import {
  createSecondaryOccupant,
  deleteSecondaryOccupant,
  LinkedTenantContactError,
  updateSecondaryOccupant,
} from "@/services/secondary-occupant-service";

import { parseUuidParam } from "./admin-query-utils";
import { parseJsonObject } from "./parse-body-utils";
import { parseNullablePhoneNumber } from "./phone-body-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";

interface ISecondaryOccupantParams {
  longStayId: string;
  membershipId?: string;
  propertyId: string;
}

function parseOptionalSecondaryEmail(
  raw: unknown,
  fieldPresent: boolean
): { email: string | null; ok: true } | { error: string; ok: false } {
  if (!fieldPresent) {
    return { email: null, ok: true };
  }
  if (raw === null) {
    return { email: null, ok: true };
  }
  if (typeof raw !== "string") {
    return { error: "email must be a string or null", ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed !== "" && !isValidTenantEmail(trimmed)) {
    return { error: "email must be a valid email address", ok: false };
  }
  return { email: trimmed === "" ? null : trimmed, ok: true };
}

function parseCreateSecondaryOccupantBody(
  raw: unknown
): { body: ICreateSecondaryOccupantBody; ok: true } | { error: string; ok: false } {
  const record = parseJsonObject(raw);
  if (!record) {
    return { error: "Body must be a JSON object", ok: false };
  }

  if (typeof record["name"] !== "string" || record["name"].trim() === "") {
    return { error: "name must be a non-empty string", ok: false };
  }

  const parsedEmail = parseOptionalSecondaryEmail(record["email"], "email" in record);
  if (!parsedEmail.ok) {
    return parsedEmail;
  }

  const body: ICreateSecondaryOccupantBody = {
    email: parsedEmail.email,
    name: record["name"].trim(),
  };

  if ("phone" in record) {
    const phoneResult = parseNullablePhoneNumber(record["phone"], "phone");
    if (!phoneResult.ok) {
      return phoneResult;
    }
    body.phone = phoneResult.phoneNumber;
  }

  return { body, ok: true };
}

function parseUpdateSecondaryOccupantBody(
  raw: unknown
): { body: IUpdateSecondaryOccupantBody; ok: true } | { error: string; ok: false } {
  const record = parseJsonObject(raw);
  if (!record) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const body: IUpdateSecondaryOccupantBody = {};

  if ("name" in record) {
    if (typeof record["name"] !== "string" || record["name"].trim() === "") {
      return { error: "name must be a non-empty string", ok: false };
    }
    body.name = record["name"].trim();
  }

  if ("email" in record) {
    const parsedEmail = parseOptionalSecondaryEmail(record["email"], true);
    if (!parsedEmail.ok) {
      return parsedEmail;
    }
    body.email = parsedEmail.email;
  }

  if ("phone" in record) {
    const phoneResult = parseNullablePhoneNumber(record["phone"], "phone");
    if (!phoneResult.ok) {
      return phoneResult;
    }
    body.phone = phoneResult.phoneNumber;
  }

  if (Object.keys(body).length === 0) {
    return { error: "At least one updatable field is required", ok: false };
  }

  return { body, ok: true };
}

async function loadWritableLongStay(
  propertyId: string,
  longStayId: string,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const hasAccess = await assertPropertyMemberAccess(
    propertyId,
    request.user.userId,
    request.user.userType,
    reply
  );
  if (!hasAccess) {
    return null;
  }

  const canWriteLedger = await assertPropertyLedgerWriteAccess(
    propertyId,
    request.user.userId,
    request.user.userType,
    reply,
    "Only property owners and managers can manage long stays"
  );
  if (!canWriteLedger) {
    return null;
  }

  const longStay = await propertyLongStaysDb.findById(longStayId);
  if (!longStay || longStay.propertyId !== propertyId) {
    reply.status(HttpStatus.NOT_FOUND).send({ error: "Long stay not found" });
    return null;
  }

  return longStay;
}

export async function propertySecondaryOccupantRoutes(server: FastifyInstance): Promise<void> {
  const authPre = [server.authenticate];

  server.post<{ Params: ISecondaryOccupantParams }>(
    "/properties/:propertyId/long-stays/:longStayId/secondary-occupants",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: ISecondaryOccupantParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }

      const parsed = parseCreateSecondaryOccupantBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const longStay = await loadWritableLongStay(propertyId, longStayId, request, reply);
      if (!longStay) return;

      try {
        const secondaryOccupant = await createSecondaryOccupant({
          body: parsed.body,
          invitedBy: request.user.userId,
          lease: longStay,
        });
        return reply.status(HttpStatus.CREATED).send({ secondaryOccupant });
      } catch (error) {
        if (error instanceof MaxSecondaryOccupantsError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        if (isDuplicatePortalInviteError(error)) {
          return reply.status(HttpStatus.CONFLICT).send({
            code: error.code,
            error: error.message,
            ...(error.body ?? {}),
          });
        }
        if (error instanceof LongStayNotActiveError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        if (error instanceof Error && error.message.includes("valid email")) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  server.patch<{ Params: ISecondaryOccupantParams & { membershipId: string } }>(
    "/properties/:propertyId/long-stays/:longStayId/secondary-occupants/:membershipId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: ISecondaryOccupantParams & { membershipId: string } }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }
      const membershipId = parseUuidParam(request.params.membershipId);
      if (membershipId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid membershipId" });
      }

      const parsed = parseUpdateSecondaryOccupantBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const longStay = await loadWritableLongStay(propertyId, longStayId, request, reply);
      if (!longStay) return;

      try {
        const secondaryOccupant = await updateSecondaryOccupant({
          body: parsed.body,
          lease: longStay,
          membershipId,
        });
        return reply.send({ secondaryOccupant });
      } catch (error) {
        if (error instanceof LinkedTenantContactError) {
          return reply.status(HttpStatus.CONFLICT).send({ error: error.message });
        }
        if (error instanceof SecondaryOccupantNotFoundError) {
          return reply.status(HttpStatus.NOT_FOUND).send({ error: error.message });
        }
        if (error instanceof LongStayNotActiveError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        if (error instanceof Error && error.message.includes("valid email")) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  server.delete<{ Params: ISecondaryOccupantParams & { membershipId: string } }>(
    "/properties/:propertyId/long-stays/:longStayId/secondary-occupants/:membershipId",
    { preHandler: authPre },
    async (
      request: FastifyRequest<{ Params: ISecondaryOccupantParams & { membershipId: string } }>,
      reply: FastifyReply
    ) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const longStayId = parseUuidParam(request.params.longStayId);
      if (longStayId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid longStayId" });
      }
      const membershipId = parseUuidParam(request.params.membershipId);
      if (membershipId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid membershipId" });
      }

      const longStay = await loadWritableLongStay(propertyId, longStayId, request, reply);
      if (!longStay) return;

      try {
        const membership = await deleteSecondaryOccupant({ lease: longStay, membershipId });
        return reply.send({ membership });
      } catch (error) {
        if (error instanceof SecondaryOccupantNotFoundError) {
          return reply.status(HttpStatus.NOT_FOUND).send({ error: error.message });
        }
        if (error instanceof LongStayNotActiveError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: error.message });
        }
        throw error;
      }
    }
  );
}
