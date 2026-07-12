import { describe, expect, mock, test } from "bun:test";

const mockQuery = mock((sql: string) => {
  if (sql.includes("COUNT(*)")) {
    return Promise.resolve({
      rows: [{ long_term_count: 2, short_term_count: 1, total_count: 3 }],
    });
  }

  return Promise.resolve({ rows: [] });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyUnitsDb } = await import("./property-units");

describe("propertyUnitsDb.getListMetaByProperty", () => {
  test("returns rental type counts for non-deleted units", async () => {
    mockQuery.mockClear();

    const meta = await propertyUnitsDb.getListMetaByProperty("prop-1");

    expect(meta).toEqual({ longTermCount: 2, shortTermCount: 1, totalCount: 3 });

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).toContain("COUNT(*) FILTER (WHERE rental_type = 'short_term')");
    expect(sql).toContain("is_deleted = false");
  });

  test("includes deleted units when requested", async () => {
    mockQuery.mockClear();

    await propertyUnitsDb.getListMetaByProperty("prop-1", true);

    const sql = mockQuery.mock.calls[0]?.[0] as string;
    expect(sql).not.toContain("is_deleted = false");
  });
});
