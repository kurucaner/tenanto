import { describe, expect, mock, test } from "bun:test";

const mockQuery = mock((sql: string) => {
  if (sql.includes("COUNT(*)")) {
    return Promise.resolve({
      rows: [{ long_term_count: 1, short_term_count: 2, total_count: 3 }],
    });
  }

  return Promise.resolve({
    rows: [
      {
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        deleted_at: null,
        id: "11111111-1111-4111-8111-111111111111",
        is_deleted: false,
        layout: "1BR",
        property_id: "prop-1",
        rental_type: "short_term",
        unit_number: "101",
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
      {
        created_at: new Date("2026-07-08T10:00:00.000Z"),
        deleted_at: null,
        id: "22222222-2222-4222-8222-222222222222",
        is_deleted: false,
        layout: "2BR",
        property_id: "prop-1",
        rental_type: "short_term",
        unit_number: "102",
        updated_at: new Date("2026-07-08T10:00:00.000Z"),
      },
      {
        created_at: new Date("2026-07-07T10:00:00.000Z"),
        deleted_at: null,
        id: "33333333-3333-4333-8333-333333333333",
        is_deleted: false,
        layout: "Studio",
        property_id: "prop-1",
        rental_type: "long_term",
        unit_number: "201",
        updated_at: new Date("2026-07-07T10:00:00.000Z"),
      },
    ],
  });
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

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("ORDER BY rental_type ASC, unit_number ASC, id ASC");
    expect(sql).toContain("LIMIT $");
  });

  test("passes cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, {
      cursor: firstPage.nextCursor!,
      limit: 2,
    });

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("(rental_type, unit_number, id) >");
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("omits meta on cursor pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, { limit: 2 });
    expect(firstPage.meta).toBeDefined();

    mockQuery.mockClear();
    const secondPage = await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, {
      cursor: firstPage.nextCursor!,
      limit: 2,
    });

    expect(secondPage.meta).toBeUndefined();
    expect(mockQuery.mock.calls).toHaveLength(1);
  });

  test("uses desc order and less-than cursor predicate when sortDir is desc", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, { limit: 2, sortDir: "desc" });

    const sql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    expect(sql).toContain("ORDER BY rental_type DESC, unit_number DESC, id DESC");

    mockQuery.mockClear();
    const firstPage = await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, {
      limit: 2,
      sortDir: "desc",
    });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertyUnitsDb.listPaginatedByProperty("prop-1", {}, {
      cursor: firstPage.nextCursor!,
      limit: 2,
      sortDir: "desc",
    });

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

    const listSql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    const countSql = mockQuery.mock.calls.find(([query]) =>
      (query as string).includes("COUNT(*)")
    )?.[0] as string;

    expect(listSql).toContain("rental_type = $");
    expect(countSql).toContain("rental_type = $");
  });

  test("applies occupancy vacant filter in list and count queries", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.listPaginatedByProperty("prop-1", { occupancy: "vacant" }, { limit: 2 });

    const listSql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    const countSql = mockQuery.mock.calls.find(([query]) =>
      (query as string).includes("COUNT(*)")
    )?.[0] as string;

    expect(listSql).toContain("NOT EXISTS");
    expect(listSql).toContain("property_long_stays");
    expect(countSql).toContain("NOT EXISTS");
    expect(countSql).toContain("property_long_stays");
  });

  test("applies search filter with tenant lookup in list and count queries", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.listPaginatedByProperty("prop-1", { q: "Tenant" }, { limit: 2 });

    const listSql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    const countSql = mockQuery.mock.calls.find(([query]) =>
      (query as string).includes("COUNT(*)")
    )?.[0] as string;

    expect(listSql).toContain("unit_number ILIKE");
    expect(listSql).toContain("pls.guest_name ILIKE");
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

    const listSql = mockQuery.mock.calls.find(
      ([query]) => !(query as string).includes("COUNT(*)")
    )?.[0] as string;
    const countSql = mockQuery.mock.calls.find(([query]) =>
      (query as string).includes("COUNT(*)")
    )?.[0] as string;

    expect(listSql).toContain("DATE(created_at) >=");
    expect(listSql).toContain("DATE(created_at) <=");
    expect(countSql).toContain("DATE(created_at) >=");
    expect(countSql).toContain("DATE(created_at) <=");
  });
});
