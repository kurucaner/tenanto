import { describe, expect, mock, test } from "bun:test";

import {
  FAVORITE_NEW_ID,
  FAVORITE_OLD_ID,
  PROPERTIES_PAGINATION_USER_ID,
  propertiesPaginationSortedRows,
} from "@/test-fixtures/pagination";

const mockQuery = mock((sql: string, values?: unknown[]) => {
  const limit = values?.at(-1) as number | undefined;
  const hasCursor = sql.includes("HAVING");

  let rows = propertiesPaginationSortedRows;
  if (hasCursor) {
    rows = rows.slice(2);
  }

  if (limit != null) {
    rows = rows.slice(0, limit);
  }

  return Promise.resolve({ rows });
});

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertiesDb } = await import("./properties");

describe("propertiesDb listPaginatedForUser favorites sort", () => {
  test("orders favorites before non-favorites with favorite-first SQL", async () => {
    mockQuery.mockClear();

    await propertiesDb.listPaginatedForUser({ limit: 10, userId: PROPERTIES_PAGINATION_USER_ID });

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain("COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) ASC");
    expect(sql).toContain("p.created_at DESC");
    expect(sql).toContain("p.id DESC");
  });

  test("returns nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertiesDb.listPaginatedForUser({
      limit: 2,
      userId: PROPERTIES_PAGINATION_USER_ID,
    });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.items[0]?.id).toBe(FAVORITE_OLD_ID);
    expect(firstPage.items[1]?.id).toBe(FAVORITE_NEW_ID);
    expect(firstPage.nextCursor).toBeString();
  });

  test("passes favorite-aware cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertiesDb.listPaginatedForUser({
      limit: 2,
      userId: PROPERTIES_PAGINATION_USER_ID,
    });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertiesDb.listPaginatedForUser({
      cursor: firstPage.nextCursor!,
      limit: 2,
      userId: PROPERTIES_PAGINATION_USER_ID,
    });

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("HAVING");
    expect(sql).toContain("COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) >");
    expect(values).toContain("2026-07-05T12:00:00.000Z");
    expect(values).toContain("2026-07-08T10:00:00.000Z");
    expect(values).toContain(FAVORITE_NEW_ID);
  });

  test("passes search filter alongside favorite sort", async () => {
    mockQuery.mockClear();

    await propertiesDb.listPaginatedForUser({
      limit: 2,
      q: "alpha",
      userId: PROPERTIES_PAGINATION_USER_ID,
    });

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ILIKE");
    expect(values).toContain("%alpha%");
    expect(sql).toContain("COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) ASC");
  });
});
