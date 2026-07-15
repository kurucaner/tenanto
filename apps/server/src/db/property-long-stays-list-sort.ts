import {
  LEASES_DEFAULT_SORT_BY,
  LEASES_DEFAULT_SORT_DIR,
  type TPropertyLongStaysListSortBy,
  type TPropertyLongStaysListSortDir,
} from "@/packages/shared";

export type TPropertyLongStaySortKeyKind = "date" | "num" | "text";

export interface IPropertyLongStaysListSortOptions {
  sortBy: TPropertyLongStaysListSortBy;
  sortColumn: string;
  sortDir: TPropertyLongStaysListSortDir;
  sortKeyKind: TPropertyLongStaySortKeyKind;
}

const LEASE_EFFECTIVE_END = "COALESCE(pls.actual_end_date, pls.lease_end_date)";

const SORT_CONFIG: Record<
  TPropertyLongStaysListSortBy,
  { column: string; kind: TPropertyLongStaySortKeyKind }
> = {
  end: { column: LEASE_EFFECTIVE_END, kind: "date" },
  rent: { column: "pls.monthly_rent", kind: "num" },
  start: { column: "pls.lease_start_date", kind: "date" },
  status: { column: "pls.status::text", kind: "text" },
  tenant: { column: "pls.guest_name", kind: "text" },
  unit: { column: "COALESCE(pu.unit_number, '')", kind: "text" },
};

function getSortKeyTypeCast(kind: TPropertyLongStaySortKeyKind): string {
  if (kind === "date") {
    return "::date";
  }
  if (kind === "num") {
    return "::numeric";
  }
  return "::text";
}

export function resolvePropertyLongStaysListSort(
  sortBy?: TPropertyLongStaysListSortBy,
  sortDir?: TPropertyLongStaysListSortDir
): IPropertyLongStaysListSortOptions {
  const resolvedSortBy = sortBy ?? LEASES_DEFAULT_SORT_BY;
  const config = SORT_CONFIG[resolvedSortBy];

  return {
    sortBy: resolvedSortBy,
    sortColumn: config.column,
    sortDir: sortDir ?? LEASES_DEFAULT_SORT_DIR,
    sortKeyKind: config.kind,
  };
}

export function needsUnitJoinForLeaseSort(sortBy: TPropertyLongStaysListSortBy): boolean {
  return sortBy === "unit";
}

export function buildPropertyLongStaysOrderByClause(
  sort: IPropertyLongStaysListSortOptions
): string {
  const direction = sort.sortDir === "asc" ? "ASC" : "DESC";
  const nulls = sort.sortDir === "asc" ? "NULLS FIRST" : "NULLS LAST";
  const tiebreakerDirection = sort.sortDir === "asc" ? "ASC" : "DESC";

  return `ORDER BY ${sort.sortColumn} ${direction} ${nulls}, pls.created_at ${tiebreakerDirection}, pls.id ${tiebreakerDirection}`;
}

export function buildPropertyLongStaysCursorPredicate(
  sort: IPropertyLongStaysListSortOptions,
  startParamIndex: number
): { nextParamIndex: number; predicate: string } {
  const operator = sort.sortDir === "asc" ? ">" : "<";
  const typeCast = getSortKeyTypeCast(sort.sortKeyKind);

  let p = startParamIndex;
  const predicate = `(${sort.sortColumn}, pls.created_at, pls.id) ${operator} ($${p++}${typeCast}, $${p++}::timestamptz, $${p++}::uuid)`;

  return { nextParamIndex: p, predicate };
}

function formatDateColumnForCursor(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  throw new TypeError("invalid date column");
}

export function readPropertyLongStaySortKeyFromRow(
  sort: IPropertyLongStaysListSortOptions,
  row: Record<string, unknown>
): string | number | null {
  if (sort.sortKeyKind === "date") {
    if (sort.sortBy === "end") {
      const actualEndDate = row.actual_end_date;
      const leaseEndDate = row.lease_end_date;
      const effectiveEndDate = actualEndDate ?? leaseEndDate;
      return effectiveEndDate == null ? null : formatDateColumnForCursor(effectiveEndDate);
    }

    return formatDateColumnForCursor(row.lease_start_date);
  }

  if (sort.sortKeyKind === "num") {
    const monthlyRent = row.monthly_rent;
    if (typeof monthlyRent === "number") {
      return monthlyRent;
    }
    if (typeof monthlyRent === "string") {
      const parsed = Number.parseFloat(monthlyRent);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  if (sort.sortBy === "unit") {
    const unitNumber = row.unit_number;
    return typeof unitNumber === "string" ? unitNumber : "";
  }

  if (sort.sortBy === "status") {
    const status = row.status;
    return typeof status === "string" ? status : null;
  }

  const guestName = row.guest_name;
  return typeof guestName === "string" ? guestName : null;
}
