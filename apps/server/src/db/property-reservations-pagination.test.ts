import { describe, expect, mock, test } from "bun:test";

import {
  buildDescendingReservationRows,
  createPaginationMockQuery,
  findCountQuerySql,
  findListQuerySql,
} from "@/test-fixtures/pagination";

const mockQuery = createPaginationMockQuery({
  rows: buildDescendingReservationRows(),
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyReservationsDb } = await import("./property-reservations");

describe("propertyReservationsDb.listPaginatedByProperty", () => {
  test("returns a page and nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );

    expect(firstPage.shortStays).toHaveLength(2);
    expect(firstPage.shortStays[0]?.checkIn).toBe("2026-07-09");
    expect(firstPage.shortStays[1]?.checkIn).toBe("2026-07-08");
    expect(firstPage.nextCursor).toBeString();
    expect(firstPage.meta).toEqual({ totalCount: 3 });
    expect(mockQuery.mock.calls).toHaveLength(2);

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("ORDER BY pr.check_in DESC, pr.created_at DESC, pr.id DESC");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("pr.check_in, pr.created_at, pr.id) <");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { limit: 2 }
    );
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      {},
      { cursor: firstPage.nextCursor!, limit: 2 }
    );

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("applies status filter", async () => {
    mockQuery.mockClear();

    await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      { status: "stayed" },
      { limit: 2 }
    );

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("pr.status = $");
  });

  test("applies search filter on guest, channel, and unit", async () => {
    mockQuery.mockClear();

    await propertyReservationsDb.listPaginatedByProperty("prop-1", { q: "alex" }, { limit: 2 });

    const sql = findListQuerySql(mockQuery);
    expect(sql).toContain("pr.guest_name ILIKE");
    expect(sql).toContain("pcc.name ILIKE");
    expect(sql).toContain("pu.unit_number ILIKE");
  });

  test("applies refundStatus filter", async () => {
    mockQuery.mockClear();

    await propertyReservationsDb.listPaginatedByProperty(
      "prop-1",
      { refundStatus: "refunded" },
      { limit: 2 }
    );

    const listSql = findListQuerySql(mockQuery);
    expect(listSql).toContain("pr.refunded_at IS NOT NULL");

    const countSql = findCountQuerySql(mockQuery);
    expect(countSql).toContain("pr.refunded_at IS NOT NULL");
  });
});
