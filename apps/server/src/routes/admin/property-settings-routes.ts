import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyExpenseCategoryTypesDb } from "@/db/property-expense-category-types";
import { propertyIncomeLineTypesDb } from "@/db/property-income-line-types";
import { propertySettingsDb } from "@/db/property-settings";
import {
  HttpStatus,
  type IPropertyExpenseCategoryTypeInput,
  type IPropertyIncomeLineTypeInput,
  type IPropertyTaxRateInput,
  type IUpdatePropertySettingsBody,
} from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";
import { assertPropertyMemberAccess, assertPropertyStructureAccess } from "./property-route-access";

const COMMISSION_FIELDS: Array<
  Exclude<
    keyof IUpdatePropertySettingsBody,
    "expenseCategoryTypes" | "incomeLineTypes" | "taxRates"
  >
> = [
  "airbnbCommissionRate",
  "bookingCommissionRate",
  "expediaCommissionRate",
  "directCommissionRate",
];

const MAX_TAX_RATES = 20;
const MAX_INCOME_LINE_TYPES = 20;
const MAX_EXPENSE_CATEGORY_TYPES = 50;
const MAX_TAX_NAME_LENGTH = 80;
const MAX_INCOME_TYPE_NAME_LENGTH = 80;
const MAX_EXPENSE_CATEGORY_NAME_LENGTH = 80;

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parseNamedSortableItem(
  item: unknown,
  index: number,
  listLabel: string,
  maxNameLength: number,
  seenNames: Set<string>
):
  | { error: string; ok: false }
  | { item: { id?: string; name: string; sortOrder: number }; ok: true } {
  if (item == null || typeof item !== "object" || Array.isArray(item)) {
    return { error: `${listLabel}[${index}] must be an object`, ok: false };
  }

  const record = item as Record<string, unknown>;
  const idRaw = record["id"];
  const nameRaw = record["name"];
  const sortOrderRaw = record["sortOrder"];

  if (idRaw != null && typeof idRaw !== "string") {
    return { error: `${listLabel}[${index}].id must be a string`, ok: false };
  }
  if (typeof nameRaw !== "string") {
    return { error: `${listLabel}[${index}].name must be a string`, ok: false };
  }

  const name = nameRaw.trim();
  if (name.length === 0) {
    return { error: `${listLabel}[${index}].name is required`, ok: false };
  }
  if (name.length > maxNameLength) {
    return {
      error: `${listLabel}[${index}].name must be at most ${maxNameLength} characters`,
      ok: false,
    };
  }

  const normalizedName = name.toLowerCase();
  if (seenNames.has(normalizedName)) {
    const uniqueErrorMap: Record<string, string> = {
      expenseCategoryTypes: "Expense category names must be unique",
      incomeLineTypes: "Income type names must be unique",
      taxRates: "Tax names must be unique",
    };
    return {
      error: uniqueErrorMap[listLabel] ?? "Names must be unique",
      ok: false,
    };
  }
  seenNames.add(normalizedName);

  if (typeof sortOrderRaw !== "number" || !Number.isInteger(sortOrderRaw) || sortOrderRaw < 0) {
    return {
      error: `${listLabel}[${index}].sortOrder must be a non-negative integer`,
      ok: false,
    };
  }

  return {
    item: {
      ...(typeof idRaw === "string" ? { id: idRaw } : {}),
      name,
      sortOrder: sortOrderRaw,
    },
    ok: true,
  };
}

function parseTaxRateItem(
  item: unknown,
  index: number,
  seenNames: Set<string>
): { error: string; ok: false } | { ok: true; taxRate: IPropertyTaxRateInput } {
  const parsed = parseNamedSortableItem(item, index, "taxRates", MAX_TAX_NAME_LENGTH, seenNames);
  if (!parsed.ok) {
    return parsed;
  }

  const rateRaw = (item as Record<string, unknown>)["rate"];
  if (!isValidRate(rateRaw)) {
    return { error: `taxRates[${index}].rate must be a number between 0 and 1`, ok: false };
  }

  return {
    ok: true,
    taxRate: {
      ...parsed.item,
      rate: rateRaw,
    },
  };
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
    const parsed = parseTaxRateItem(raw[index], index, seenNames);
    if (!parsed.ok) {
      return parsed;
    }
    taxRates.push(parsed.taxRate);
  }

  return { ok: true, taxRates };
}

function parseIncomeLineTypes(raw: unknown):
  | { error: string; incomeLineTypes: IPropertyIncomeLineTypeInput[]; ok: false }
  | {
      incomeLineTypes: IPropertyIncomeLineTypeInput[];
      ok: true;
    } {
  if (!Array.isArray(raw)) {
    return { error: "incomeLineTypes must be an array", incomeLineTypes: [], ok: false };
  }
  if (raw.length > MAX_INCOME_LINE_TYPES) {
    return {
      error: `You can configure up to ${MAX_INCOME_LINE_TYPES} income types`,
      incomeLineTypes: [],
      ok: false,
    };
  }

  const incomeLineTypes: IPropertyIncomeLineTypeInput[] = [];
  const seenNames = new Set<string>();

  for (let index = 0; index < raw.length; index += 1) {
    const parsed = parseNamedSortableItem(
      raw[index],
      index,
      "incomeLineTypes",
      MAX_INCOME_TYPE_NAME_LENGTH,
      seenNames
    );
    if (!parsed.ok) {
      return { ...parsed, incomeLineTypes: [] };
    }
    incomeLineTypes.push(parsed.item);
  }

  return { incomeLineTypes, ok: true };
}

function parseExpenseCategoryTypes(
  raw: unknown
):
  | { error: string; expenseCategoryTypes: IPropertyExpenseCategoryTypeInput[]; ok: false }
  | { expenseCategoryTypes: IPropertyExpenseCategoryTypeInput[]; ok: true } {
  if (!Array.isArray(raw)) {
    return {
      error: "expenseCategoryTypes must be an array",
      expenseCategoryTypes: [],
      ok: false,
    };
  }
  if (raw.length > MAX_EXPENSE_CATEGORY_TYPES) {
    return {
      error: `You can configure up to ${MAX_EXPENSE_CATEGORY_TYPES} expense categories`,
      expenseCategoryTypes: [],
      ok: false,
    };
  }

  const expenseCategoryTypes: IPropertyExpenseCategoryTypeInput[] = [];
  const seenNames = new Set<string>();

  for (let index = 0; index < raw.length; index += 1) {
    const parsed = parseNamedSortableItem(
      raw[index],
      index,
      "expenseCategoryTypes",
      MAX_EXPENSE_CATEGORY_NAME_LENGTH,
      seenNames
    );
    if (!parsed.ok) {
      return { ...parsed, expenseCategoryTypes: [] };
    }

    const record = raw[index] as Record<string, unknown>;
    const isAnnualAmount =
      typeof record["isAnnualAmount"] === "boolean" ? record["isAnnualAmount"] : false;

    expenseCategoryTypes.push({ ...parsed.item, isAnnualAmount });
  }

  return { expenseCategoryTypes, ok: true };
}

function parseUpdateSettingsBody(
  raw: unknown
): { body: IUpdatePropertySettingsBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const r = raw as Record<string, unknown>;
  const allowedKeys = new Set<string>([
    ...COMMISSION_FIELDS,
    "expenseCategoryTypes",
    "incomeLineTypes",
    "taxRates",
  ]);
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

  if ("incomeLineTypes" in r) {
    const parsedIncomeLineTypes = parseIncomeLineTypes(r["incomeLineTypes"]);
    if (!parsedIncomeLineTypes.ok) {
      return { error: parsedIncomeLineTypes.error, ok: false };
    }
    body.incomeLineTypes = parsedIncomeLineTypes.incomeLineTypes;
  }

  if ("expenseCategoryTypes" in r) {
    const parsedExpenseCategoryTypes = parseExpenseCategoryTypes(r["expenseCategoryTypes"]);
    if (!parsedExpenseCategoryTypes.ok) {
      return { error: parsedExpenseCategoryTypes.error, ok: false };
    }
    body.expenseCategoryTypes = parsedExpenseCategoryTypes.expenseCategoryTypes;
  }

  if (Object.keys(body).length === 0) {
    return { error: "At least one settings field is required", ok: false };
  }

  return { body, ok: true };
}

async function validateIncomeLineTypeRemoval(
  propertyId: string,
  incoming: IPropertyIncomeLineTypeInput[]
): Promise<{ error: string; ok: false } | { ok: true }> {
  const existing = await propertyIncomeLineTypesDb.findByProperty(propertyId);
  const incomingIds = new Set(incoming.flatMap((input) => (input.id != null ? [input.id] : [])));
  const removed = existing.filter((type) => !incomingIds.has(type.id));

  for (const type of removed) {
    const count = await propertyIncomeLineTypesDb.countUsage(type.id);
    if (count > 0) {
      return {
        error: `Cannot remove "${type.name}" because ${count} income line(s) still use it`,
        ok: false,
      };
    }
  }

  return { ok: true };
}

async function validateExpenseCategoryTypeRemoval(
  propertyId: string,
  incoming: IPropertyExpenseCategoryTypeInput[]
): Promise<{ error: string; ok: false } | { ok: true }> {
  const existing = await propertyExpenseCategoryTypesDb.findByProperty(propertyId);
  const incomingIds = new Set(incoming.flatMap((input) => (input.id != null ? [input.id] : [])));
  const removed = existing.filter((type) => !incomingIds.has(type.id));

  for (const type of removed) {
    const count = await propertyExpenseCategoryTypesDb.countUsage(type.id);
    if (count > 0) {
      return {
        error: `Cannot remove "${type.name}" because ${count} expense(s) still use it`,
        ok: false,
      };
    }
  }

  return { ok: true };
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

      if (parsed.body.incomeLineTypes != null) {
        const removalCheck = await validateIncomeLineTypeRemoval(
          propertyId,
          parsed.body.incomeLineTypes
        );
        if (!removalCheck.ok) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: removalCheck.error });
        }
      }

      if (parsed.body.expenseCategoryTypes != null) {
        const removalCheck = await validateExpenseCategoryTypeRemoval(
          propertyId,
          parsed.body.expenseCategoryTypes
        );
        if (!removalCheck.ok) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: removalCheck.error });
        }
      }

      const settings = await propertySettingsDb.updateWithTaxRates(propertyId, parsed.body);
      if (!settings) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Settings not found" });
      }

      return reply.send({ settings });
    }
  );
};
