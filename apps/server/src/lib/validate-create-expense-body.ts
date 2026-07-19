import type { ICreatePropertyExpenseBody } from "@/packages/shared";

import { getTodayUtcIsoDate } from "./date-utils";

export { getTodayUtcIsoDate };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDateString(raw: unknown): string | null {
  if (typeof raw !== "string" || !DATE_RE.test(raw.trim())) return null;
  const date = Date.parse(`${raw.trim()}T00:00:00Z`);
  if (!Number.isFinite(date)) return null;
  return raw.trim();
}

function parseOptionalDateString(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  return parseDateString(raw);
}

export function parseCategoryId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return UUID_RE.test(raw.trim()) ? raw.trim() : null;
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

function parseBoolean(raw: unknown): boolean | null {
  if (typeof raw !== "boolean") return null;
  return raw;
}

export function parseCreateExpenseBody(
  raw: unknown
): { body: ICreatePropertyExpenseBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const r = raw as Record<string, unknown>;

  const categoryId = parseCategoryId(r["categoryId"]);
  if (categoryId === null) {
    return { error: "categoryId must be a valid UUID", ok: false };
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

  const description = parseOptionalString(r["description"]);
  if (
    description === null &&
    r["description"] !== undefined &&
    r["description"] !== null &&
    typeof r["description"] !== "string"
  ) {
    return { error: "description must be a string", ok: false };
  }

  let cashExpense: boolean | undefined;
  if (r["cashExpense"] !== undefined) {
    const parsedCashExpense = parseBoolean(r["cashExpense"]);
    if (parsedCashExpense === null) return { error: "cashExpense must be a boolean", ok: false };
    cashExpense = parsedCashExpense;
  }

  return {
    body: {
      amount,
      categoryId,
      description: description ?? undefined,
      expenseDate: expenseDate ?? undefined,
      cashExpense,
    },
    ok: true,
  };
}

export function validateExpenseDateNotInFuture(expenseDate: string | undefined): string | null {
  if (expenseDate === undefined) {
    return null;
  }
  if (expenseDate > getTodayUtcIsoDate()) {
    return "Expense date cannot be in the future";
  }
  return null;
}
