import { type TPropertyExpensesListFilters } from "@/packages/shared";

export function normalizeExpenseExportFilters(
  filters: TPropertyExpensesListFilters
): TPropertyExpensesListFilters {
  const normalized: TPropertyExpensesListFilters = {};

  if (filters.from != null && filters.from !== "") {
    normalized.from = filters.from;
  }
  if (filters.to != null && filters.to !== "") {
    normalized.to = filters.to;
  }
  if (filters.categoryId != null && filters.categoryId !== "") {
    normalized.categoryId = filters.categoryId;
  }

  const qTrim = filters.q?.trim();
  if (qTrim != null && qTrim !== "") {
    normalized.q = qTrim;
  }

  return normalized;
}

export function serializeExpenseExportFilters(filters: TPropertyExpensesListFilters): string {
  return JSON.stringify(normalizeExpenseExportFilters(filters));
}
