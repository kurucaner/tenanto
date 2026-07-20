import { describe, expect, mock, test } from "bun:test";

import {
  buildDescendingExportJobRows,
  createPaginationMockQuery,
  findListQuerySql,
} from "@/test-fixtures/pagination";

const mockQuery = createPaginationMockQuery({
  rows: buildDescendingExportJobRows(),
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { exportJobsDb } = await import("./export-jobs");

describe("exportJobsDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await exportJobsDb.listPaginatedByProperty("prop-1", { limit: 2 });

    expect(firstPage.exports).toHaveLength(2);
    expect(firstPage.exports[0]?.fileName).toBe("expenses-july.csv");
    expect(firstPage.exports[1]?.fileName).toBe("income-june.xlsx");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("ORDER BY created_at DESC NULLS LAST");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await exportJobsDb.listPaginatedByProperty("prop-1", { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await exportJobsDb.listPaginatedByProperty("prop-1", {
      cursor: firstPage.nextCursor!,
      limit: 2,
    });

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("(created_at, created_at, id) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("applies resourceType and search filters", async () => {
    mockQuery.mockClear();

    await exportJobsDb.listPaginatedByProperty("prop-1", {
      filters: { q: "income", resourceType: "income" },
      limit: 10,
    });

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("resource_type = $");
    expect(sql).toContain("file_name ILIKE");
  });

  test("applies requested-date range filters", async () => {
    mockQuery.mockClear();

    await exportJobsDb.listPaginatedByProperty("prop-1", {
      filters: { from: "2026-07-01", to: "2026-07-31" },
      limit: 10,
    });

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("created_at >=");
    expect(sql).toContain("created_at <");
  });
});
