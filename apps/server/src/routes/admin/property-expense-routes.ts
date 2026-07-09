import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyExpensesDb } from "@/db/property-expenses";
import {
  parseCreateExpenseBody,
  parseDateString,
  parseExpenseCategory,
  validateExpenseDateNotInFuture,
} from "@/lib/validate-create-expense-body";
import {
  ExpenseCategory,
  EXPENSES_LIST_LIMIT,
  EXPENSES_LIST_MAX_LIMIT,
  HttpStatus,
  type IPropertyExpense,
  type IPropertyExpensesListQuery,
  type IUpdatePropertyExpenseBody,
  type TExpenseCategory,
  UserType,
  validateExpenseCategoryFields,
} from "@/packages/shared";
import { decodeExpenseKeysetCursor } from "@/pagination/keyset-cursor";

import { parseUuidParam } from "./admin-query-utils";
import { parseJsonObject, parseMoney as parseBodyMoney } from "./parse-body-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";
import { rejectIfDeleted } from "./reject-if-deleted";

const EXPENSE_CATEGORIES = new Set<TExpenseCategory>(Object.values(ExpenseCategory));

function parseExpensesListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return EXPENSES_LIST_LIMIT;
  return Math.min(EXPENSES_LIST_MAX_LIMIT, Math.floor(n));
}

function parseOptionalDateString(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  return parseDateString(raw);
}

function parseOptionalString(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return null;
  return raw.trim();
}

function parseBoolean(raw: unknown): boolean | null {
  if (typeof raw !== "boolean") return null;
  return raw;
}

const UPDATE_FIELDS = ["category", "amount", "expenseDate", "description", "taxFree"] as const;

function parseUpdateExpenseCategory(
  r: Record<string, unknown>,
  body: IUpdatePropertyExpenseBody
): string | null {
  if (r["category"] === undefined) return null;
  const category = parseExpenseCategory(r["category"]);
  if (category === null) {
    return `category must be one of: ${[...EXPENSE_CATEGORIES].join(", ")}`;
  }
  body.category = category;
  return null;
}

function parseUpdateExpenseAmount(
  r: Record<string, unknown>,
  body: IUpdatePropertyExpenseBody
): string | null {
  if (r["amount"] === undefined) return null;
  const amount = parseBodyMoney(r["amount"]);
  if (amount === null) return "amount must be a non-negative number";
  body.amount = amount;
  return null;
}

function parseUpdateExpenseDate(
  r: Record<string, unknown>,
  body: IUpdatePropertyExpenseBody
): string | null {
  if (r["expenseDate"] === undefined) return null;
  const expenseDate = parseOptionalDateString(r["expenseDate"]);
  if (expenseDate === null && r["expenseDate"] !== null && r["expenseDate"] !== "") {
    return "expenseDate must be a YYYY-MM-DD date";
  }
  body.expenseDate = expenseDate ?? null;
  return null;
}

function parseUpdateExpenseDescription(
  r: Record<string, unknown>,
  body: IUpdatePropertyExpenseBody
): string | null {
  if (r["description"] === undefined) return null;
  const description = parseOptionalString(r["description"]);
  if (description === null && r["description"] !== null && typeof r["description"] !== "string") {
    return "description must be a string";
  }
  body.description = description ?? null;
  return null;
}

function parseUpdateExpenseTaxFree(
  r: Record<string, unknown>,
  body: IUpdatePropertyExpenseBody
): string | null {
  if (r["taxFree"] === undefined) return null;
  const taxFree = parseBoolean(r["taxFree"]);
  if (taxFree === null) return "taxFree must be a boolean";
  body.taxFree = taxFree;
  return null;
}

function parseUpdateExpenseBody(
  raw: unknown
): { body: IUpdatePropertyExpenseBody; ok: true } | { error: string; ok: false } {
  const r = parseJsonObject(raw);
  if (!r) {
    return { error: "Body must be a JSON object", ok: false };
  }

  for (const key of Object.keys(r)) {
    if (!UPDATE_FIELDS.includes(key as (typeof UPDATE_FIELDS)[number])) {
      return { error: `Unknown field: ${key}`, ok: false };
    }
  }

  const body: IUpdatePropertyExpenseBody = {};
  const fieldError =
    parseUpdateExpenseCategory(r, body) ??
    parseUpdateExpenseAmount(r, body) ??
    parseUpdateExpenseDate(r, body) ??
    parseUpdateExpenseDescription(r, body) ??
    parseUpdateExpenseTaxFree(r, body);
  if (fieldError) {
    return { error: fieldError, ok: false };
  }

  if (Object.keys(body).length === 0) {
    return { error: "At least one field is required", ok: false };
  }

  return { body, ok: true };
}

function parseExpensesListQuery(query: Record<string, unknown>):
  | {
      cursor?: string;
      filters: Pick<IPropertyExpensesListQuery, "category" | "from" | "to">;
      limit: number;
      ok: true;
    }
  | { error: string; ok: false } {
  const filters: Pick<IPropertyExpensesListQuery, "category" | "from" | "to"> = {};

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
  if (query["category"] !== undefined && query["category"] !== "") {
    const category = parseExpenseCategory(query["category"]);
    if (category === null) {
      return {
        error: `category must be one of: ${[...EXPENSE_CATEGORIES].join(", ")}`,
        ok: false,
      };
    }
    filters.category = category;
  }

  const limit = parseExpensesListLimit(query["limit"]);
  const cursor =
    typeof query["cursor"] === "string" && query["cursor"] !== "" ? query["cursor"] : undefined;

  return { cursor, filters, limit, ok: true };
}

interface IPropertyParams {
  propertyId: string;
}

interface IPropertyExpenseParams {
  expenseId: string;
  propertyId: string;
}

function mergeExpenseInput(existing: IPropertyExpense, patch: IUpdatePropertyExpenseBody) {
  return {
    amount: patch.amount ?? existing.amount,
    category: patch.category ?? existing.category,
    description: patch.description === undefined ? existing.description : patch.description,
    expenseDate: patch.expenseDate === undefined ? existing.expenseDate : patch.expenseDate,
    taxFree: patch.taxFree ?? existing.taxFree,
  };
}

export const propertyExpenseRoutes = async (server: FastifyInstance): Promise<void> => {
  const authPre = [server.authenticate];

  server.get<{ Params: IPropertyParams; Querystring: Record<string, unknown> }>(
    "/properties/:propertyId/expenses",
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

      const parsed = parseExpensesListQuery(request.query);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      if (parsed.cursor != null) {
        try {
          decodeExpenseKeysetCursor(parsed.cursor);
        } catch {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid cursor" });
        }
      }

      const includeDeleted = request.user.userType === UserType.ADMIN;
      const { expenses, nextCursor } = await propertyExpensesDb.listPaginatedByProperty(
        propertyId,
        parsed.filters,
        { cursor: parsed.cursor, includeDeleted, limit: parsed.limit }
      );
      return reply.send({ expenses, nextCursor });
    }
  );

  server.post<{ Params: IPropertyParams }>(
    "/properties/:propertyId/expenses",
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
        "Only property owners and managers can manage expenses"
      );
      if (!isOwner) return;

      const parsed = parseCreateExpenseBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      if (parsed.body.expenseDate !== undefined) {
        const futureDateError = validateExpenseDateNotInFuture(parsed.body.expenseDate);
        if (futureDateError) {
          return reply.status(HttpStatus.BAD_REQUEST).send({ error: futureDateError });
        }
      }

      const expense = await propertyExpensesDb.create(propertyId, {
        amount: parsed.body.amount,
        category: parsed.body.category,
        description: parsed.body.description?.trim() || null,
        expenseDate: parsed.body.expenseDate ?? null,
        taxFree: parsed.body.taxFree ?? false,
      });

      return reply.status(HttpStatus.CREATED).send({ expense });
    }
  );

  server.patch<{ Params: IPropertyExpenseParams }>(
    "/properties/:propertyId/expenses/:expenseId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyExpenseParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const expenseId = parseUuidParam(request.params.expenseId);
      if (expenseId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid expenseId" });
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
        "Only property owners and managers can manage expenses"
      );
      if (!isOwner) return;

      const existing = await propertyExpensesDb.findById(expenseId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Expense not found" });
      }

      if (rejectIfDeleted(existing, reply, "expense")) return;

      const parsed = parseUpdateExpenseBody(request.body);
      if (!parsed.ok) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: parsed.error });
      }

      const merged = mergeExpenseInput(existing, parsed.body);
      const categoryError = validateExpenseCategoryFields(merged.category, {
        description: merged.description,
      });
      if (categoryError) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: categoryError });
      }

      const expense = await propertyExpensesDb.update(expenseId, parsed.body);
      return reply.send({ expense });
    }
  );

  server.delete<{ Params: IPropertyExpenseParams }>(
    "/properties/:propertyId/expenses/:expenseId",
    { preHandler: authPre },
    async (request: FastifyRequest<{ Params: IPropertyExpenseParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const expenseId = parseUuidParam(request.params.expenseId);
      if (expenseId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid expenseId" });
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
        "Only property owners and managers can manage expenses"
      );
      if (!isOwner) return;

      const existing = await propertyExpensesDb.findById(expenseId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Expense not found" });
      }

      if (rejectIfDeleted(existing, reply, "expense")) return;

      await propertyExpensesDb.softDelete(expenseId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );

  server.post<{ Params: IPropertyExpenseParams }>(
    "/properties/:propertyId/expenses/:expenseId/restore",
    { preHandler: [server.authenticate, server.requireAdmin] },
    async (request: FastifyRequest<{ Params: IPropertyExpenseParams }>, reply: FastifyReply) => {
      const propertyId = parseUuidParam(request.params.propertyId);
      if (propertyId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid propertyId" });
      }
      const expenseId = parseUuidParam(request.params.expenseId);
      if (expenseId === null) {
        return reply.status(HttpStatus.BAD_REQUEST).send({ error: "Invalid expenseId" });
      }

      const existing = await propertyExpensesDb.findById(expenseId);
      if (!existing || existing.propertyId !== propertyId) {
        return reply.status(HttpStatus.NOT_FOUND).send({ error: "Expense not found" });
      }

      await propertyExpensesDb.restore(expenseId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
