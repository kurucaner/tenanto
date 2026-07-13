import type {
  TPropertyIncomeEntriesListSortBy,
  TPropertyIncomeEntriesListSortDir,
} from "./property-income-entries-types";

export const INCOME_ENTRIES_LIST_LIMIT = 50;
export const INCOME_ENTRIES_LIST_MAX_LIMIT = 100;

/** Canonical server ORDER BY for the unified income-entries list (Phase 3+). */
export const INCOME_ENTRIES_DEFAULT_SORT_BY = "date";
export const INCOME_ENTRIES_DEFAULT_SORT_DIR = "desc";

export const INCOME_ENTRIES_SORT_BY_VALUES = [
  "channel",
  "checkOut",
  "cleaning",
  "commission",
  "date",
  "gross",
  "guest",
  "net",
  "netPayout",
  "nights",
  "roomTotal",
  "status",
  "taxes",
  "type",
  "unit",
] as const satisfies readonly TPropertyIncomeEntriesListSortBy[];

export const INCOME_ENTRIES_SORT_DIR_VALUES = [
  "asc",
  "desc",
] as const satisfies readonly TPropertyIncomeEntriesListSortDir[];
