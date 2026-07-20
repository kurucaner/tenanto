import { describe, expect, mock, test } from "bun:test";

import {
  buildDescendingIncomeLineRows,
  createPaginationMockQuery,
  findCountQuerySql,
  findListQuerySql,
  TEST_INCOME_LINE_TYPE_ID,
} from "@/test-fixtures/pagination";

const mockQuery = createPaginationMockQuery({
  rows: buildDescendingIncomeLineRows(),
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyIncomeLinesDb } = await import("./property-income-lines");

describe("propertyIncomeLinesDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );

    expect(firstPage.incomeLines).toHaveLength(2);
    expect(firstPage.incomeLines[0]?.transactionDate).toBe("2026-07-09");
    expect(firstPage.incomeLines[1]?.transactionDate).toBe("2026-07-08");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("ORDER BY pil.transaction_date DESC, pil.created_at DESC, pil.id DESC");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("pil.transaction_date, pil.created_at, pil.id) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("applies incomeLineTypeId filter", async () => {
    mockQuery.mockClear();

    await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      { incomeLineTypeId: TEST_INCOME_LINE_TYPE_ID },
      { limit: 2 }
    );

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("pil.income_line_type_id = $");
  });

  test("applies search filter on guest, description, and type name", async () => {
    mockQuery.mockClear();

    await propertyIncomeLinesDb.listPaginatedByProperty("prop-1", { q: "parking" }, { limit: 2 });

    const listSql = findListQuerySql(mockQuery);
    expect(listSql).toContain("pil.guest_name");
    expect(listSql).toContain("pil.description");
    expect(listSql).toContain("ilt.name ILIKE");

    const metaSql = findCountQuerySql(mockQuery);
    expect(metaSql).toContain("property_income_line_types ilt");
  });

  test("applies refundStatus filter", async () => {
    mockQuery.mockClear();

    await propertyIncomeLinesDb.listPaginatedByProperty(
      "prop-1",
      { refundStatus: "not_refunded" },
      { limit: 2 }
    );

    const listSql = findListQuerySql(mockQuery);
    expect(listSql).toContain("pil.refunded_at IS NULL");

    const countSql = findCountQuerySql(mockQuery);
    expect(countSql).toContain("pil.refunded_at IS NULL");
  });
});
