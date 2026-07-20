import {
  INCOME_ENTRIES_SORT_BY_VALUES,
  INCOME_ENTRIES_SORT_DIR_VALUES,
  IncomeEntryKind,
  ReservationStatus,
  type TPropertyIncomeEntriesListSortBy,
  type TPropertyIncomeEntriesListSortDir,
  type TReservationStatus,
} from "@/packages/shared";

import { parseOptionalUuid } from "./admin-query-utils";

const RESERVATION_STATUSES = new Set<TReservationStatus>(Object.values(ReservationStatus));

export function parseIncomeReservationStatus(raw: unknown): TReservationStatus | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return RESERVATION_STATUSES.has(raw as TReservationStatus) ? (raw as TReservationStatus) : null;
}

export function parseIncomeTypeFilter(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  if (trimmed === IncomeEntryKind.STAY) return IncomeEntryKind.STAY;
  if (trimmed === IncomeEntryKind.LONG_TERM) return IncomeEntryKind.LONG_TERM;
  return parseOptionalUuid(trimmed) ?? null;
}

export function parseIncomeEntriesSortBy(
  raw: unknown
): TPropertyIncomeEntriesListSortBy | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return (INCOME_ENTRIES_SORT_BY_VALUES as readonly string[]).includes(raw)
    ? (raw as TPropertyIncomeEntriesListSortBy)
    : null;
}

export function parseIncomeEntriesSortDir(
  raw: unknown
): TPropertyIncomeEntriesListSortDir | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return (INCOME_ENTRIES_SORT_DIR_VALUES as readonly string[]).includes(raw)
    ? (raw as TPropertyIncomeEntriesListSortDir)
    : null;
}
