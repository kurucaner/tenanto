import { describe, expect, mock, test } from "bun:test";

import {
  buildDescendingExpenseRows,
  createPaginationMockQuery,
  findListQuerySql,
} from "@/test-fixtures/pagination";

const mockQuery = createPaginationMockQuery({
  rows: buildDescendingExpenseRows(),
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyExpensesDb } = await import("./property-expenses");

describe("propertyExpensesDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyExpensesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });

    expect(firstPage.expenses).toHaveLength(2);
    expect(firstPage.expenses[0]?.expenseDate).toBe("2026-07-09");
    expect(firstPage.expenses[1]?.expenseDate).toBe("2026-07-08");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("COALESCE(pe.expense_date");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyExpensesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyExpensesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("pe.created_at, pe.id) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyExpensesDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyExpensesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("applies search filter on description and category name", async () => {
    mockQuery.mockClear();

    await propertyExpensesDb.listPaginatedByProperty("prop-1", { q: "clean" }, { limit: 2 });

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("pe.description ILIKE");
    expect(sql).toContain("pect.name ILIKE");
  });
});
