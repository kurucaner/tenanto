import { describe, expect, mock, test } from "bun:test";

import {
  buildDescendingLongStayRows,
  createPaginationMockQuery,
  findCountQuerySql,
  findListQuerySql,
  LONG_STAY_PAGINATION_COUNT_ROW,
} from "@/test-fixtures/pagination";

const mockQuery = createPaginationMockQuery({
  countRow: LONG_STAY_PAGINATION_COUNT_ROW,
  rows: buildDescendingLongStayRows(),
});

mock.module("@/services/hydrate-long-stays-secondary-occupant-names", () => ({
  hydrateLongStaysSecondaryOccupantNames: (longStays: readonly unknown[]) =>
    Promise.resolve([...longStays]),
}));

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyLongStaysDb } = await import("./property-long-stays");

describe("propertyLongStaysDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyLongStaysDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });

    expect(firstPage.longStays).toHaveLength(2);
    expect(firstPage.longStays[0]?.leaseStartDate).toBe("2026-07-09");
    expect(firstPage.longStays[1]?.leaseStartDate).toBe("2026-01-01");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ activeCount: 1, endedCount: 2, totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("pls.lease_start_date DESC");
    expect(sql).toContain("LIMIT $");
  });

  test("applies search filter with unit join in list and count queries", async () => {
    mockQuery.mockClear();

    await propertyLongStaysDb.listPaginatedByProperty("prop-1", { q: "Tenant" }, { limit: 2 });

    const listSql = findListQuerySql(mockQuery);
    const countSql = findCountQuerySql(mockQuery);

    expect(listSql).toContain("property_units pu");
    expect(listSql).toContain("pls.guest_name ILIKE");
    expect(countSql).toContain("property_units pu");
    expect(countSql).toContain("pls.guest_name ILIKE");
  });

  test("applies overlap date filters in list and count queries", async () => {
    mockQuery.mockClear();

    await propertyLongStaysDb.listPaginatedByProperty(
      "prop-1",
      { from: "2026-07-01", to: "2026-07-31" },
      { limit: 2 }
    );

    const listSql = findListQuerySql(mockQuery);
    const countSql = findCountQuerySql(mockQuery);

    expect(listSql).toContain("COALESCE(pls.actual_end_date, pls.lease_end_date) >=");
    expect(listSql).toContain("pls.lease_start_date <=");
    expect(countSql).toContain("COALESCE(pls.actual_end_date, pls.lease_end_date) >=");
    expect(countSql).toContain("pls.lease_start_date <=");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyLongStaysDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyLongStaysDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("(pls.lease_start_date, pls.created_at, pls.id) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyLongStaysDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyLongStaysDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
    expect(mockQuery.mock.calls[0]?.[0] as string).toContain("LIMIT $");
  });
});
