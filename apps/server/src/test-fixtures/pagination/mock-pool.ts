import { mock } from "bun:test";

export interface IPaginationMockQueryOptions {
  countRow?: Record<string, unknown>;
  rows: Record<string, unknown>[];
  totalCount?: number;
}

function isPaginationCountQuery(sql: string): boolean {
  return (
    sql.includes("AS total_count") ||
    sql.includes("AS active_count") ||
    sql.includes("AS long_term_count")
  );
}

export function createPaginationMockQuery(options: IPaginationMockQueryOptions) {
  const { countRow, rows, totalCount = rows.length } = options;

  return mock((sql: string) => {
    if (isPaginationCountQuery(sql)) {
      return Promise.resolve({
        rows: [countRow ?? { total_count: totalCount }],
      });
    }

    return Promise.resolve({ rows });
  });
}

export function findListQuerySql(
  mockQuery: ReturnType<typeof createPaginationMockQuery>
): string {
  const call = mockQuery.mock.calls.find(([query]) => !isPaginationCountQuery(query as string));
  return call?.[0] as string;
}

export function findCountQuerySql(
  mockQuery: ReturnType<typeof createPaginationMockQuery>
): string {
  const call = mockQuery.mock.calls.find(([query]) => isPaginationCountQuery(query as string));
  return call?.[0] as string;
}
