import { describe, expect, mock, test } from "bun:test";

import {
  buildDescendingUnitRows,
  createPaginationMockQuery,
  findCountQuerySql,
  findListQuerySql,
  UNIT_PAGINATION_COUNT_ROW,
} from "@/test-fixtures/pagination";

const mockQuery = createPaginationMockQuery({
  countRow: UNIT_PAGINATION_COUNT_ROW,
  rows: buildDescendingUnitRows(),
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyUnitsDb } = await import("./property-units");

describe("propertyUnitsDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });

    expect(firstPage.units).toHaveLength(2);
    expect(firstPage.units[0]?.unitNumber).toBe("101");
    expect(firstPage.units[1]?.unitNumber).toBe("102");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ longTermCount: 1, shortTermCount: 2, totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("ORDER BY rental_type ASC, unit_number ASC, id ASC");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyUnitsDb.listPaginatedByProperty(
      "prop-1",
      {},
      {
        cursor: firstPage.nextCursor!,
        limit: 2,
      }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("(rental_type, unit_number, id) >");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyUnitsDb.listPaginatedByProperty(
      "prop-1",
      {},
      {
        cursor: firstPage.nextCursor!,
        limit: 2,
      }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("uses desc order and less-than cursor predicate when sortDir is desc", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, { limit: 2, sortDir: "desc" });

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("ORDER BY rental_type DESC, unit_number DESC, id DESC");

    mockQuery.mockClear();
    const firstPage = await propertyUnitsDb.listPaginatedByProperty(
      "prop-1",
      {},
      {
        limit: 2,
        sortDir: "desc",
      }
    );
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyUnitsDb.listPaginatedByProperty(
      "prop-1",
      {},
      {
        cursor: firstPage.nextCursor!,
        limit: 2,
        sortDir: "desc",
      }
    );

    const cursorSql = mockQuery.mock.calls[0]?.[0] as string;
    expect(cursorSql).toContain("(rental_type, unit_number, id) <");
  });

  test("applies rental type filter in list and count queries", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.listPaginatedByProperty(
      "prop-1",
      { rentalType: "long_term" },
      { limit: 2 }
    );

    const listSql = findListQuerySql(mockQuery);
    const countSql = findCountQuerySql(mockQuery);

    expect(listSql).toContain("rental_type = $");
    expect(countSql).toContain("rental_type = $");
  });

  test("applies occupancy vacant filter in list and count queries", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.listPaginatedByProperty("prop-1", { occupancy: "vacant" }, { limit: 2 });

    const listSql = findListQuerySql(mockQuery);
    const countSql = findCountQuerySql(mockQuery);

    expect(listSql).toContain("NOT EXISTS");
    expect(listSql).toContain("property_long_stays");
    expect(countSql).toContain("NOT EXISTS");
    expect(countSql).toContain("property_long_stays");
  });

  test("applies search filter with tenant lookup in list and count queries", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.listPaginatedByProperty("prop-1", { q: "Tenant" }, { limit: 2 });

    const listSql = findListQuerySql(mockQuery);
    const countSql = findCountQuerySql(mockQuery);

    expect(listSql).toContain("unit_number ILIKE");
    expect(listSql).toContain("pls.guest_name ILIKE");
    expect(listSql).toContain("lease_tenant_memberships ltm");
    expect(listSql).not.toContain("jsonb_array_elements");
    expect(countSql).toContain("unit_number ILIKE");
    expect(countSql).toContain("pls.guest_name ILIKE");
  });

  test("applies added date filters in list and count queries", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.listPaginatedByProperty(
      "prop-1",
      { from: "2026-07-01", to: "2026-07-31" },
      { limit: 2 }
    );

    const listSql = findListQuerySql(mockQuery);
    const countSql = findCountQuerySql(mockQuery);

    expect(listSql).toContain("DATE(created_at) >=");
    expect(listSql).toContain("DATE(created_at) <=");
    expect(countSql).toContain("DATE(created_at) >=");
    expect(countSql).toContain("DATE(created_at) <=");
  });
});
