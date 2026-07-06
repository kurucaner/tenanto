import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertySettingsDb } from "@/db/property-settings";
import {
  HttpStatus,
  type IUpdatePropertySettingsBody,
} from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyMemberAccess,
  assertPropertyStructureAccess,
} from "./property-route-access";

const SETTINGS_FIELDS: (keyof IUpdatePropertySettingsBody)[] = [
  "salesTaxRate",
  "miamiDadeSurtaxRate",
  "conventionDevelopmentTaxRate",
  "resortTaxRate",
  "airbnbCommissionRate",
  "bookingCommissionRate",
  "expediaCommissionRate",
  "directCommissionRate",
];

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parseUpdateSettingsBody(
  raw: unknown
): { body: IUpdatePropertySettingsBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const r = raw as Record<string, unknown>;
  const unknownKeys = Object.keys(r).filter(
    (key) => !SETTINGS_FIELDS.includes(key as keyof IUpdatePropertySettingsBody)
  );
  if (unknownKeys.length > 0) {
    return { error: `Unknown fields: ${unknownKeys.join(", ")}`, ok: false };
  }

  const body: IUpdatePropertySettingsBody = {};
  for (const field of SETTINGS_FIELDS) {
    if (!(field in r)) continue;
    const value = r[field];
    if (!isValidRate(value)) {
      return { error: `${field} must be a number between 0 and 1`, ok: false };
    }
    body[field] = value;
  }

  if (Object.keys(body).length === 0) {
    return { error: "At least one settings field is required", ok: false };
  }

  return { body, ok: true };
}

interface IPropertyParams {
  propertyId: string;
}

export const propertySettingsRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams }>(
    "/properties/:propertyId/settings",
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

      const settings = await propertySettingsDb.getOrCreateDefaults(propertyId);
      return reply.send({ settings });
    }
  );

  server.patch<{ Params: IPropertyParams }>(
    "/properties/:propertyId/settings",
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

      const canEdit = await assertPropertyStructureAccess(
        propertyId,
        request.user.userId,
        request.user.userType,
        reply,
        "Only property owners can edit settings"
      );
      if (!canEdit) return;

      const parsed = parseUpdateSettingsBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      await propertySettingsDb.getOrCreateDefaults(propertyId);

      const settings = await propertySettingsDb.update(propertyId, parsed.body);
      if (!settings) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Settings not found" });
      }

      return reply.send({ settings });
    }
  );
};
