import { parseCategoryId, parseDateString } from "@/lib/validate-create-expense-body";
import {
  ExportFormat,
  ExportResourceType,
  INCOME_ENTRIES_SORT_BY_VALUES,
  IncomeEntryKind,
  type IPropertyExportCreateRequest,
  ReservationStatus,
  type TPropertyExpensesListFilters,
  type TPropertyIncomeEntriesListFilters,
  type TPropertyLongStaysListFilters,
  type TReservationStatus,
} from "@/packages/shared";

import { parseOptionalUuid } from "./admin-query-utils";
import { parseJsonObject } from "./parse-body-utils";
import { applyOptionalQuerySearchFilter } from "./parse-list-query-filters";

const RESERVATION_STATUSES = new Set<TReservationStatus>(Object.values(ReservationStatus));

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

function parseIncomeExportFilters(
  raw: unknown
): { filters: TPropertyIncomeEntriesListFilters; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { filters: {}, ok: true };
  }

  const record = raw as Record<string, unknown>;
  const filters: TPropertyIncomeEntriesListFilters = {};

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
  if (record.unitId !== undefined && record.unitId !== "") {
    const unitId = parseOptionalUuid(record.unitId);
    if (unitId === null) return { error: "filters.unitId must be a valid UUID", ok: false };
    if (unitId) filters.unitId = unitId;
  }

  const searchResult = applyOptionalQuerySearchFilter(record, filters);
  if (!searchResult.ok) {
    return searchResult;
  }

  if (record.channelCommissionId !== undefined && record.channelCommissionId !== "") {
    const channelCommissionId = parseOptionalUuid(record.channelCommissionId);
    if (channelCommissionId === null) {
      return { error: "filters.channelCommissionId must be a valid UUID", ok: false };
    }
    if (channelCommissionId) filters.channelCommissionId = channelCommissionId;
  }

  if (record.status !== undefined && record.status !== "") {
    const status = typeof record.status === "string" ? record.status : "";
    if (!RESERVATION_STATUSES.has(status as TReservationStatus)) {
      return { error: "filters.status is invalid", ok: false };
    }
    filters.status = status as TReservationStatus;
  }

  if (record.incomeType !== undefined && record.incomeType !== "") {
    const incomeTypeRaw = typeof record.incomeType === "string" ? record.incomeType.trim() : "";
    if (incomeTypeRaw === IncomeEntryKind.STAY) {
      filters.incomeType = IncomeEntryKind.STAY;
    } else {
      const incomeType = parseOptionalUuid(incomeTypeRaw);
      if (incomeType === null) {
        return {
          error: "filters.incomeType must be 'stay' or a valid income line type id",
          ok: false,
        };
      }
      if (incomeType) filters.incomeType = incomeType;
    }
  }

  if (record.refundStatus === "refunded" || record.refundStatus === "not_refunded") {
    filters.refundStatus = record.refundStatus;
  }

  if (record.sortBy !== undefined && record.sortBy !== "") {
    const sortBy = typeof record.sortBy === "string" ? record.sortBy : "";
    if (!(INCOME_ENTRIES_SORT_BY_VALUES as readonly string[]).includes(sortBy)) {
      return { error: "filters.sortBy is invalid", ok: false };
    }
    filters.sortBy = sortBy as TPropertyIncomeEntriesListFilters["sortBy"];
  }

  if (record.sortDir === "asc" || record.sortDir === "desc") {
    filters.sortDir = record.sortDir;
  } else if (record.sortDir !== undefined && record.sortDir !== "") {
    return { error: "filters.sortDir must be asc or desc", ok: false };
  }

  return { filters, ok: true };
}

function parseLeaseExportFilters(
  raw: unknown
): { filters: TPropertyLongStaysListFilters; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { filters: {}, ok: true };
  }

  const record = raw as Record<string, unknown>;
  const filters: TPropertyLongStaysListFilters = {};

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
  if (record.unitId !== undefined && record.unitId !== "") {
    const unitId = parseOptionalUuid(record.unitId);
    if (unitId === null) return { error: "filters.unitId must be a valid UUID", ok: false };
    if (unitId) filters.unitId = unitId;
  }

  const searchResult = applyOptionalQuerySearchFilter(record, filters);
  if (!searchResult.ok) {
    return searchResult;
  }

  if (record.status === "active" || record.status === "ended") {
    filters.status = record.status;
  } else if (record.status !== undefined && record.status !== "") {
    return { error: "filters.status must be active or ended", ok: false };
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
