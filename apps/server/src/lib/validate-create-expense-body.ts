import {
  ExpenseCategory,
  type ICreatePropertyExpenseBody,
  type TExpenseCategory,
  validateExpenseCategoryFields,
} from "@/packages/shared";

const EXPENSE_CATEGORIES = new Set<TExpenseCategory>(Object.values(ExpenseCategory));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateString(raw: unknown): string | null {
  if (typeof raw !== "string" || !DATE_RE.test(raw.trim())) return null;
  const date = Date.parse(`${raw.trim()}T00:00:00Z`);
  if (!Number.isFinite(date)) return null;
  return raw.trim();
}

export function getTodayUtcIsoDate(): string {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseOptionalDateString(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  return parseDateString(raw);
}

export function parseExpenseCategory(raw: unknown): TExpenseCategory | null {
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

  const description = parseOptionalString(r["description"]);
  if (
    description === null &&
    r["description"] !== undefined &&
    r["description"] !== null &&
    typeof r["description"] !== "string"
  ) {
    return { error: "description must be a string", ok: false };
  }

  let taxFree: boolean | undefined;
  if (r["taxFree"] !== undefined) {
    const parsedTaxFree = parseBoolean(r["taxFree"]);
    if (parsedTaxFree === null) return { error: "taxFree must be a boolean", ok: false };
    taxFree = parsedTaxFree;
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
      taxFree,
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

export function normalizeExpenseImportCategory(raw: unknown): TExpenseCategory {
  return parseExpenseCategory(raw) ?? ExpenseCategory.OTHER;
}
