import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { propertyExpensesDb } from "@/db/property-expenses";
import {
  ExpenseCategory,
  HttpStatus,
  type ICreatePropertyExpenseBody,
  type IPropertyExpense,
  type IPropertyExpensesListQuery,
  type IUpdatePropertyExpenseBody,
  type TExpenseCategory,
  validateExpenseCategoryFields,
} from "@/packages/shared";

import { parseUuidParam } from "./admin-query-utils";
import {
  assertPropertyLedgerWriteAccess,
  assertPropertyMemberAccess,
} from "./property-route-access";

const EXPENSE_CATEGORIES = new Set<TExpenseCategory>(Object.values(ExpenseCategory));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function parseOptionalDateString(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  return parseDateString(raw);
}

function parseExpenseCategory(raw: unknown): TExpenseCategory | null {
  if (typeof raw !== "string") return null;
  return EXPENSE_CATEGORIES.has(raw as TExpenseCategory) ? (raw as TExpenseCategory) : null;
}

function parseMoney(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

function parseOptionalString(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return null;
  return raw.trim();
}

function parseCreateExpenseBody(
  raw: unknown
): { body: ICreatePropertyExpenseBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;

  const category = parseExpenseCategory(r["category"]);
  if (category === null) {
    return {
      error: `category must be one of: ${[...EXPENSE_CATEGORIES].join(", ")}`,
      ok: false,
    };
  }

  const amount = parseMoney(r["amount"]);
  if (amount === null) return { error: "amount must be a non-negative number", ok: false };

  const expenseDate = parseOptionalDateString(r["expenseDate"]);
  if (
    expenseDate === null &&
    r["expenseDate"] !== undefined &&
    r["expenseDate"] !== null &&
    r["expenseDate"] !== ""
  ) {
    return { error: "expenseDate must be a YYYY-MM-DD date", ok: false };
  }

  const personName = parseOptionalString(r["personName"]);
  if (
    personName === null &&
    r["personName"] !== undefined &&
    r["personName"] !== null &&
    typeof r["personName"] !== "string"
  ) {
    return { error: "personName must be a string", ok: false };
  }

  const description = parseOptionalString(r["description"]);
  if (
    description === null &&
    r["description"] !== undefined &&
    r["description"] !== null &&
    typeof r["description"] !== "string"
  ) {
    return { error: "description must be a string", ok: false };
  }

  const categoryError = validateExpenseCategoryFields(category, {
    description: description ?? undefined,
  });
  if (categoryError) return { error: categoryError, ok: false };

  return {
    body: {
      amount,
      category,
      description: description ?? undefined,
      expenseDate: expenseDate ?? undefined,
      personName: personName ?? undefined,
    },
    ok: true,
  };
}

const UPDATE_FIELDS = ["category", "amount", "expenseDate", "personName", "description"] as const;

function parseUpdateExpenseBody(
  raw: unknown
): { body: IUpdatePropertyExpenseBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;
  const body: IUpdatePropertyExpenseBody = {};

  for (const key of Object.keys(r)) {
    if (!UPDATE_FIELDS.includes(key as (typeof UPDATE_FIELDS)[number])) {
      return { error: `Unknown field: ${key}`, ok: false };
    }
  }

  if (r["category"] !== undefined) {
    const category = parseExpenseCategory(r["category"]);
    if (category === null) {
      return {
        error: `category must be one of: ${[...EXPENSE_CATEGORIES].join(", ")}`,
        ok: false,
      };
    }
    body.category = category;
  }

  if (r["amount"] !== undefined) {
    const amount = parseMoney(r["amount"]);
    if (amount === null) return { error: "amount must be a non-negative number", ok: false };
    body.amount = amount;
  }

  if (r["expenseDate"] !== undefined) {
    const expenseDate = parseOptionalDateString(r["expenseDate"]);
    if (expenseDate === null && r["expenseDate"] !== null && r["expenseDate"] !== "") {
      return { error: "expenseDate must be a YYYY-MM-DD date", ok: false };
    }
    body.expenseDate = expenseDate ?? null;
  }

  if (r["personName"] !== undefined) {
    const personName = parseOptionalString(r["personName"]);
    if (personName === null && r["personName"] !== null && typeof r["personName"] !== "string") {
      return { error: "personName must be a string", ok: false };
    }
    body.personName = personName ?? null;
  }

  if (r["description"] !== undefined) {
    const description = parseOptionalString(r["description"]);
    if (description === null && r["description"] !== null && typeof r["description"] !== "string") {
      return { error: "description must be a string", ok: false };
    }
    body.description = description ?? null;
  }

  if (Object.keys(body).length === 0) {
    return { error: "At least one field is required", ok: false };
  }

  return { body, ok: true };
}

function parseExpensesListQuery(
  query: Record<string, unknown>
): { filters: IPropertyExpensesListQuery; ok: true } | { error: string; ok: false } {
  const filters: IPropertyExpensesListQuery = {};

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

  return { filters, ok: true };
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
    personName: patch.personName === undefined ? existing.personName : patch.personName,
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

      const expenses = await propertyExpensesDb.findByProperty(propertyId, parsed.filters);
      return reply.send({ expenses });
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

      if (
        parsed.body.expenseDate !== undefined &&
        parsed.body.expenseDate > getTodayUtcIsoDate()
      ) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ error: "Expense date cannot be in the future" });
      }

      const expense = await propertyExpensesDb.create(propertyId, {
        amount: parsed.body.amount,
        category: parsed.body.category,
        description: parsed.body.description?.trim() || null,
        expenseDate: parsed.body.expenseDate ?? null,
        personName: parsed.body.personName?.trim() || null,
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

      await propertyExpensesDb.delete(expenseId);
      return reply.status(HttpStatus.NO_CONTENT).send();
    }
  );
};
