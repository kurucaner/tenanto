import {
  ExportResourceType,
  type TExportResourceType,
  type TPropertyExpensesListFilters,
  type TPropertyIncomeEntriesListFilters,
  type TPropertyLongStaysListFilters,
} from "@/packages/shared";

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

export function normalizeIncomeExportFilters(
  filters: TPropertyIncomeEntriesListFilters
): TPropertyIncomeEntriesListFilters {
  const normalized: TPropertyIncomeEntriesListFilters = {};

  if (filters.from != null && filters.from !== "") {
    normalized.from = filters.from;
  }
  if (filters.to != null && filters.to !== "") {
    normalized.to = filters.to;
  }
  if (filters.unitId != null && filters.unitId !== "") {
    normalized.unitId = filters.unitId;
  }
  if (filters.channelCommissionId != null && filters.channelCommissionId !== "") {
    normalized.channelCommissionId = filters.channelCommissionId;
  }
  if (filters.incomeType != null && filters.incomeType !== "") {
    normalized.incomeType = filters.incomeType;
  }
  if (filters.status != null) {
    normalized.status = filters.status;
  }
  if (filters.refundStatus != null) {
    normalized.refundStatus = filters.refundStatus;
  }
  if (filters.sortBy != null) {
    normalized.sortBy = filters.sortBy;
  }
  if (filters.sortDir != null) {
    normalized.sortDir = filters.sortDir;
  }

  const qTrim = filters.q?.trim();
  if (qTrim != null && qTrim !== "") {
    normalized.q = qTrim;
  }

  return normalized;
}

export function normalizeLeaseExportFilters(
  filters: TPropertyLongStaysListFilters
): TPropertyLongStaysListFilters {
  const normalized: TPropertyLongStaysListFilters = {};

  if (filters.from != null && filters.from !== "") {
    normalized.from = filters.from;
  }
  if (filters.to != null && filters.to !== "") {
    normalized.to = filters.to;
  }
  if (filters.unitId != null && filters.unitId !== "") {
    normalized.unitId = filters.unitId;
  }
  if (filters.status != null) {
    normalized.status = filters.status;
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

export function serializeIncomeExportFilters(filters: TPropertyIncomeEntriesListFilters): string {
  return JSON.stringify(normalizeIncomeExportFilters(filters));
}

export function serializeLeaseExportFilters(filters: TPropertyLongStaysListFilters): string {
  return JSON.stringify(normalizeLeaseExportFilters(filters));
}

export function serializeExportJobFilters(
  resourceType: TExportResourceType,
  filters:
    TPropertyExpensesListFilters | TPropertyIncomeEntriesListFilters | TPropertyLongStaysListFilters
): string {
  if (resourceType === ExportResourceType.EXPENSES) {
    return serializeExpenseExportFilters(filters as TPropertyExpensesListFilters);
  }
  if (resourceType === ExportResourceType.INCOME) {
    return serializeIncomeExportFilters(filters as TPropertyIncomeEntriesListFilters);
  }
  return serializeLeaseExportFilters(filters as TPropertyLongStaysListFilters);
}
