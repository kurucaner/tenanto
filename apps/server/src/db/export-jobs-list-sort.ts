import {
  PROPERTY_EXPORTS_DEFAULT_SORT_BY,
  PROPERTY_EXPORTS_DEFAULT_SORT_DIR,
  type TPropertyExportsListSortBy,
  type TPropertyExportsListSortDir,
} from "@/packages/shared";

export type TExportJobSortKeyKind = "date" | "num" | "text";

export interface IExportJobsListSortOptions {
  sortBy: TPropertyExportsListSortBy;
  sortColumn: string;
  sortDir: TPropertyExportsListSortDir;
  sortKeyKind: TExportJobSortKeyKind;
}

const SORT_CONFIG: Record<
  TPropertyExportsListSortBy,
  { column: string; kind: TExportJobSortKeyKind }
> = {
  format: { column: "format", kind: "text" },
  requestedAt: { column: "created_at", kind: "date" },
  resourceType: { column: "resource_type", kind: "text" },
  rowCount: { column: "row_count", kind: "num" },
  status: { column: "status", kind: "text" },
};

function getSortKeyTypeCast(kind: TExportJobSortKeyKind): string {
  if (kind === "date") {
    return "::timestamptz";
  }
  if (kind === "num") {
    return "::numeric";
  }
  return "::text";
}

export function resolveExportJobsListSort(
  sortBy?: TPropertyExportsListSortBy,
  sortDir?: TPropertyExportsListSortDir
): IExportJobsListSortOptions {
  const resolvedSortBy = sortBy ?? PROPERTY_EXPORTS_DEFAULT_SORT_BY;
  const config = SORT_CONFIG[resolvedSortBy];

  return {
    sortBy: resolvedSortBy,
    sortColumn: config.column,
    sortDir: sortDir ?? PROPERTY_EXPORTS_DEFAULT_SORT_DIR,
    sortKeyKind: config.kind,
  };
}

export function buildExportJobsOrderByClause(sort: IExportJobsListSortOptions): string {
  const direction = sort.sortDir === "asc" ? "ASC" : "DESC";
  const nulls = sort.sortDir === "asc" ? "NULLS FIRST" : "NULLS LAST";
  const tiebreakerDirection = sort.sortDir === "asc" ? "ASC" : "DESC";

  return `ORDER BY ${sort.sortColumn} ${direction} ${nulls}, created_at ${tiebreakerDirection}, id ${tiebreakerDirection}`;
}

export function buildExportJobsCursorPredicate(
  sort: IExportJobsListSortOptions,
  startParamIndex: number
): { nextParamIndex: number; predicate: string } {
  const operator = sort.sortDir === "asc" ? ">" : "<";
  const typeCast = getSortKeyTypeCast(sort.sortKeyKind);

  let p = startParamIndex;
  const predicate = `(${sort.sortColumn}, created_at, id) ${operator} ($${p++}${typeCast}, $${p++}::timestamptz, $${p++}::uuid)`;

  return { nextParamIndex: p, predicate };
}

export function readExportJobSortKeyFromRow(
  sort: IExportJobsListSortOptions,
  row: Record<string, unknown>
): string | number | null {
  if (sort.sortKeyKind === "date") {
    const createdAt = row.created_at as Date | string;
    return typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  }

  if (sort.sortKeyKind === "num") {
    const rowCount = row.row_count;
    return typeof rowCount === "number" ? rowCount : null;
  }

  const value = row[sort.sortColumn];
  return typeof value === "string" ? value : null;
}
