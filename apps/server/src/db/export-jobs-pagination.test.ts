import { describe, expect, mock, test } from "bun:test";

const mockQuery = mock((sql: string) => {
  if (sql.includes("COUNT(*)")) {
    return Promise.resolve({
      rows: [{ total_count: 3 }],
    });
  }

  return Promise.resolve({
    rows: [
      {
        completed_at: null,
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        created_by: "user-1",
        error_message: null,
        expires_at: null,
        file_name: "expenses-july.csv",
        filters: {},
        format: "csv",
        id: "11111111-1111-4111-8111-111111111111",
        property_id: "prop-1",
        resource_type: "expenses",
        row_count: 42,
        status: "completed",
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
      {
        completed_at: null,
        created_at: new Date("2026-07-08T10:00:00.000Z"),
        created_by: "user-1",
        error_message: null,
        expires_at: null,
        file_name: "income-june.xlsx",
        filters: {},
        format: "xlsx",
        id: "22222222-2222-4222-8222-222222222222",
        property_id: "prop-1",
        resource_type: "income",
        row_count: 18,
        status: "completed",
        updated_at: new Date("2026-07-08T10:00:00.000Z"),
      },
      {
        completed_at: null,
        created_at: new Date("2026-07-07T10:00:00.000Z"),
        created_by: "user-1",
        error_message: null,
        expires_at: null,
        file_name: "leases-q2.csv",
        filters: {},
        format: "csv",
        id: "33333333-3333-4333-8333-333333333333",
        property_id: "prop-1",
        resource_type: "leases",
        row_count: 5,
        status: "completed",
        updated_at: new Date("2026-07-07T10:00:00.000Z"),
      },
    ],
  });
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

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
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

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("resource_type = $");
    expect(sql).toContain("file_name ILIKE");
  });

  test("applies requested-date range filters", async () => {
    mockQuery.mockClear();

    await exportJobsDb.listPaginatedByProperty("prop-1", {
      filters: { from: "2026-07-01", to: "2026-07-31" },
      limit: 10,
    });

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("created_at >=");
    expect(sql).toContain("created_at <");
  });
});
