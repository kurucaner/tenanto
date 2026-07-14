import { parseCategoryId, parseDateString } from "@/lib/validate-create-expense-body";
import {
  ExportFormat,
  ExportResourceType,
  type IPropertyExportCreateRequest,
  type TPropertyExpensesListFilters,
  type TPropertyIncomeEntriesListFilters,
  type TPropertyLongStaysListFilters,
} from "@/packages/shared";

import { type TQueryParseResult } from "./admin-query-utils";
import { parseJsonObject } from "./parse-body-utils";
import {
  parseIncomeEntriesSortBy,
  parseIncomeEntriesSortDir,
  parseIncomeReservationStatus,
  parseIncomeTypeFilter,
} from "./parse-income-entries-filter-fields";
import {
  applyOptionalQueryDateFilter,
  applyOptionalQuerySearchFilter,
  applyOptionalQueryUuidFilter,
} from "./parse-list-query-filters";

function parseExpenseExportFilters(
  raw: unknown
): { filters: TPropertyExpensesListFilters; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { filters: {}, ok: true };
  }

  const record = raw as Record<string, unknown>;
  const filters: TPropertyExpensesListFilters = {};

  if (record.from !== undefined && record.from !== "") {
    const from = parseDateString(record.from);
    if (!from) return { error: "filters.from must be a YYYY-MM-DD date", ok: false };
    filters.from = from;
  }
  if (record.to !== undefined && record.to !== "") {
    const to = parseDateString(record.to);
    if (!to) return { error: "filters.to must be a YYYY-MM-DD date", ok: false };
    filters.to = to;
  }
  if (record.categoryId !== undefined && record.categoryId !== "") {
    const categoryId = parseCategoryId(record.categoryId);
    if (categoryId === null) {
      return { error: "filters.categoryId must be a valid UUID", ok: false };
    }
    filters.categoryId = categoryId;
  }

  const searchResult = applyOptionalQuerySearchFilter(record, filters);
  if (!searchResult.ok) {
    return searchResult;
  }

  return { filters, ok: true };
}

function applyIncomeExportStatusFilter(
  record: Record<string, unknown>,
  filters: TPropertyIncomeEntriesListFilters
): TQueryParseResult<void> {
  const status = parseIncomeReservationStatus(record.status);
  if (status === null) {
    return { error: "filters.status is invalid", ok: false };
  }
  if (status) {
    filters.status = status;
  }
  return { ok: true };
}

function applyIncomeExportIncomeTypeFilter(
  record: Record<string, unknown>,
  filters: TPropertyIncomeEntriesListFilters
): TQueryParseResult<void> {
  const incomeType = parseIncomeTypeFilter(record.incomeType);
  if (incomeType === null) {
    return {
      error: "filters.incomeType must be 'stay' or a valid income line type id",
      ok: false,
    };
  }
  if (incomeType) {
    filters.incomeType = incomeType;
  }
  return { ok: true };
}

function applyIncomeExportRefundStatusFilter(
  record: Record<string, unknown>,
  filters: TPropertyIncomeEntriesListFilters
): TQueryParseResult<void> {
  if (record.refundStatus === "refunded" || record.refundStatus === "not_refunded") {
    filters.refundStatus = record.refundStatus;
  }
  return { ok: true };
}

function applyIncomeExportSortByFilter(
  record: Record<string, unknown>,
  filters: TPropertyIncomeEntriesListFilters
): TQueryParseResult<void> {
  const sortBy = parseIncomeEntriesSortBy(record.sortBy);
  if (sortBy === null) {
    return { error: "filters.sortBy is invalid", ok: false };
  }
  if (sortBy) {
    filters.sortBy = sortBy;
  }
  return { ok: true };
}

function applyIncomeExportSortDirFilter(
  record: Record<string, unknown>,
  filters: TPropertyIncomeEntriesListFilters
): TQueryParseResult<void> {
  const sortDir = parseIncomeEntriesSortDir(record.sortDir);
  if (sortDir === null) {
    return { error: "filters.sortDir must be asc or desc", ok: false };
  }
  if (sortDir) {
    filters.sortDir = sortDir;
  }
  return { ok: true };
}

function parseIncomeExportFilters(
  raw: unknown
): { filters: TPropertyIncomeEntriesListFilters; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { filters: {}, ok: true };
  }

  const record = raw as Record<string, unknown>;
  const filters: TPropertyIncomeEntriesListFilters = {};

  const filterSteps: Array<() => TQueryParseResult<void>> = [
    () =>
      applyOptionalQueryDateFilter(
        record,
        "from",
        filters,
        "filters.from must be a YYYY-MM-DD date"
      ),
    () =>
      applyOptionalQueryDateFilter(record, "to", filters, "filters.to must be a YYYY-MM-DD date"),
    () =>
      applyOptionalQueryUuidFilter(
        record,
        "unitId",
        filters,
        "filters.unitId must be a valid UUID"
      ),
    () => applyOptionalQuerySearchFilter(record, filters),
    () =>
      applyOptionalQueryUuidFilter(
        record,
        "channelCommissionId",
        filters,
        "filters.channelCommissionId must be a valid UUID"
      ),
    () => applyIncomeExportStatusFilter(record, filters),
    () => applyIncomeExportIncomeTypeFilter(record, filters),
    () => applyIncomeExportRefundStatusFilter(record, filters),
    () => applyIncomeExportSortByFilter(record, filters),
    () => applyIncomeExportSortDirFilter(record, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) {
      return result;
    }
  }

  return { filters, ok: true };
}

function applyLeaseExportStatusFilter(
  record: Record<string, unknown>,
  filters: TPropertyLongStaysListFilters
): TQueryParseResult<void> {
  if (record.status === "active" || record.status === "ended") {
    filters.status = record.status;
    return { ok: true };
  }

  if (record.status !== undefined && record.status !== "") {
    return { error: "filters.status must be active or ended", ok: false };
  }

  return { ok: true };
}

function parseLeaseExportFilters(
  raw: unknown
): { filters: TPropertyLongStaysListFilters; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { filters: {}, ok: true };
  }

  const record = raw as Record<string, unknown>;
  const filters: TPropertyLongStaysListFilters = {};

  const filterSteps: Array<() => TQueryParseResult<void>> = [
    () =>
      applyOptionalQueryDateFilter(
        record,
        "from",
        filters,
        "filters.from must be a YYYY-MM-DD date"
      ),
    () =>
      applyOptionalQueryDateFilter(record, "to", filters, "filters.to must be a YYYY-MM-DD date"),
    () =>
      applyOptionalQueryUuidFilter(
        record,
        "unitId",
        filters,
        "filters.unitId must be a valid UUID"
      ),
    () => applyOptionalQuerySearchFilter(record, filters),
    () => applyLeaseExportStatusFilter(record, filters),
  ];

  for (const applyFilter of filterSteps) {
    const result = applyFilter();
    if (!result.ok) {
      return result;
    }
  }

  return { filters, ok: true };
}

export function parseCreateExportBody(
  raw: unknown
): { body: IPropertyExportCreateRequest; ok: true } | { error: string; ok: false } {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return { error: "Invalid JSON body", ok: false };
  }

  const resourceType = parsed.resourceType;
  const format = parsed.format;

  if (
    resourceType !== ExportResourceType.EXPENSES &&
    resourceType !== ExportResourceType.INCOME &&
    resourceType !== ExportResourceType.LEASES
  ) {
    return { error: "resourceType must be expenses, income, or leases", ok: false };
  }
  if (format !== ExportFormat.CSV && format !== ExportFormat.XLSX) {
    return { error: "format must be csv or xlsx", ok: false };
  }

  if (resourceType === ExportResourceType.EXPENSES) {
    const filtersResult = parseExpenseExportFilters(parsed.filters);
    if (!filtersResult.ok) return filtersResult;
    return {
      body: { filters: filtersResult.filters, format, resourceType },
      ok: true,
    };
  }

  if (resourceType === ExportResourceType.INCOME) {
    const filtersResult = parseIncomeExportFilters(parsed.filters);
    if (!filtersResult.ok) return filtersResult;
    return {
      body: { filters: filtersResult.filters, format, resourceType },
      ok: true,
    };
  }

  const filtersResult = parseLeaseExportFilters(parsed.filters);
  if (!filtersResult.ok) return filtersResult;
  return {
    body: { filters: filtersResult.filters, format, resourceType },
    ok: true,
  };
}
