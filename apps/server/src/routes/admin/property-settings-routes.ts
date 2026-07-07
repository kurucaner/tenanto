import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertySettingsDb } from "@/db/property-settings";
import {
  HttpStatus,
  type IPropertyTaxRateInput,
  type IUpdatePropertySettingsBody,
} from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyMemberAccess,
  assertPropertyStructureAccess,
} from "./property-route-access";

const COMMISSION_FIELDS: Array<Exclude<keyof IUpdatePropertySettingsBody, "taxRates">> = [
  "airbnbCommissionRate",
  "bookingCommissionRate",
  "expediaCommissionRate",
  "directCommissionRate",
];

const MAX_TAX_RATES = 20;
const MAX_TAX_NAME_LENGTH = 80;

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parseTaxRates(
  raw: unknown
): { ok: true; taxRates: IPropertyTaxRateInput[] } | { error: string; ok: false } {
  if (!Array.isArray(raw)) {
    return { error: "taxRates must be an array", ok: false };
  }
  if (raw.length > MAX_TAX_RATES) {
    return { error: `You can configure up to ${MAX_TAX_RATES} tax rates`, ok: false };
  }

  const taxRates: IPropertyTaxRateInput[] = [];
  const seenNames = new Set<string>();

  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      return { error: `taxRates[${index}] must be an object`, ok: false };
    }

    const record = item as Record<string, unknown>;
    const idRaw = record["id"];
    const nameRaw = record["name"];
    const rateRaw = record["rate"];
    const sortOrderRaw = record["sortOrder"];

    if (idRaw != null && typeof idRaw !== "string") {
      return { error: `taxRates[${index}].id must be a string`, ok: false };
    }
    if (typeof nameRaw !== "string") {
      return { error: `taxRates[${index}].name must be a string`, ok: false };
    }

    const name = nameRaw.trim();
    if (name.length === 0) {
      return { error: `taxRates[${index}].name is required`, ok: false };
    }
    if (name.length > MAX_TAX_NAME_LENGTH) {
      return {
        error: `taxRates[${index}].name must be at most ${MAX_TAX_NAME_LENGTH} characters`,
        ok: false,
      };
    }

    const normalizedName = name.toLowerCase();
    if (seenNames.has(normalizedName)) {
      return { error: "Tax names must be unique", ok: false };
    }
    seenNames.add(normalizedName);

    if (!isValidRate(rateRaw)) {
      return { error: `taxRates[${index}].rate must be a number between 0 and 1`, ok: false };
    }

    if (typeof sortOrderRaw !== "number" || !Number.isInteger(sortOrderRaw) || sortOrderRaw < 0) {
      return { error: `taxRates[${index}].sortOrder must be a non-negative integer`, ok: false };
    }

    taxRates.push({
      ...(typeof idRaw === "string" ? { id: idRaw } : {}),
      name,
      rate: rateRaw,
      sortOrder: sortOrderRaw,
    });
  }

  return { ok: true, taxRates };
}

function parseUpdateSettingsBody(
  raw: unknown
): { body: IUpdatePropertySettingsBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const r = raw as Record<string, unknown>;
  const allowedKeys = new Set<string>([...COMMISSION_FIELDS, "taxRates"]);
  const unknownKeys = Object.keys(r).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    return { error: `Unknown fields: ${unknownKeys.join(", ")}`, ok: false };
  }

  const body: IUpdatePropertySettingsBody = {};
  for (const field of COMMISSION_FIELDS) {
    if (!(field in r)) continue;
    const value = r[field];
    if (!isValidRate(value)) {
      return { error: `${field} must be a number between 0 and 1`, ok: false };
    }
    body[field] = value;
  }

  if ("taxRates" in r) {
    const parsedTaxRates = parseTaxRates(r["taxRates"]);
    if (!parsedTaxRates.ok) {
      return { error: parsedTaxRates.error, ok: false };
    }
    body.taxRates = parsedTaxRates.taxRates;
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

      const settings = await propertySettingsDb.updateWithTaxRates(propertyId, parsed.body);
      if (!settings) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Settings not found" });
      }

      return reply.send({ settings });
    }
  );
};
