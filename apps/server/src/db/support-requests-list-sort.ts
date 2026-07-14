import {
  SUPPORT_REQUESTS_DEFAULT_SORT_BY,
  SUPPORT_REQUESTS_DEFAULT_SORT_DIR,
  type TSupportRequestsListSortBy,
  type TSupportRequestsListSortDir,
} from "@/packages/shared";

export interface ISupportRequestsListSortOptions {
  sortBy: TSupportRequestsListSortBy;
  sortColumn: string;
  sortDir: TSupportRequestsListSortDir;
  sortKeyCast: "::text" | "::timestamptz";
}

const SORT_CONFIG: Record<
  TSupportRequestsListSortBy,
  {
    cast: ISupportRequestsListSortOptions["sortKeyCast"];
    column: string;
    rowKey: string;
  }
> = {
  category: { cast: "::text", column: "sr.category::text", rowKey: "category" },
  createdAt: { cast: "::timestamptz", column: "sr.created_at", rowKey: "created_at" },
  status: { cast: "::text", column: "sr.status::text", rowKey: "status" },
  updatedAt: { cast: "::timestamptz", column: "sr.updated_at", rowKey: "updated_at" },
};

export function resolveSupportRequestsListSort(
  sortBy?: TSupportRequestsListSortBy,
  sortDir?: TSupportRequestsListSortDir
): ISupportRequestsListSortOptions {
  const resolvedSortBy = sortBy ?? SUPPORT_REQUESTS_DEFAULT_SORT_BY;
  const config = SORT_CONFIG[resolvedSortBy];
  return {
    sortBy: resolvedSortBy,
    sortColumn: config.column,
    sortDir: sortDir ?? SUPPORT_REQUESTS_DEFAULT_SORT_DIR,
    sortKeyCast: config.cast,
  };
}

export function buildSupportRequestsOrderByClause(sort: ISupportRequestsListSortOptions): string {
  const direction = sort.sortDir === "asc" ? "ASC" : "DESC";
  return `ORDER BY ${sort.sortColumn} ${direction}, sr.created_at ${direction}, sr.id ${direction}`;
}

export function buildSupportRequestsCursorPredicate(
  sort: ISupportRequestsListSortOptions,
  startParamIndex: number
): { nextParamIndex: number; predicate: string } {
  const operator = sort.sortDir === "asc" ? ">" : "<";
  const predicate = `(${sort.sortColumn}, sr.created_at, sr.id) ${operator} ($${startParamIndex}${sort.sortKeyCast}, $${startParamIndex + 1}::timestamptz, $${startParamIndex + 2}::uuid)`;
  return { nextParamIndex: startParamIndex + 3, predicate };
}

export function readSupportRequestSortKey(
  sort: ISupportRequestsListSortOptions,
  row: Record<string, unknown>
): string {
  const key = SORT_CONFIG[sort.sortBy].rowKey;
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  throw new Error(`Missing support request sort key: ${key}`);
}
