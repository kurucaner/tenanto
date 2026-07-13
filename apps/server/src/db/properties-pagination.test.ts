import { describe, expect, mock, test } from "bun:test";

const USER_ID = "22222222-2222-4222-8222-222222222222";

const FAVORITE_OLD_ID = "11111111-1111-4111-8111-111111111111";
const FAVORITE_NEW_ID = "22222222-2222-4222-8222-222222222222";
const UNFAVORITE_NEW_ID = "33333333-3333-4333-8333-333333333333";
const UNFAVORITE_OLD_ID = "44444444-4444-4444-8444-444444444444";

function propertyRow(input: {
  createdAt: string;
  favoritedAt: Date | null;
  id: string;
  name: string;
}) {
  return {
    address: "123 Main St",
    created_at: new Date(input.createdAt),
    created_by: USER_ID,
    favorited_at: input.favoritedAt,
    id: input.id,
    legal_name: null,
    member_count: 1,
    name: input.name,
    phone_number: null,
    unit_count: 0,
    updated_at: new Date(input.createdAt),
  };
}

const SORTED_ROWS = [
  propertyRow({
    createdAt: "2026-07-09T10:00:00.000Z",
    favoritedAt: new Date("2026-07-01T12:00:00.000Z"),
    id: FAVORITE_OLD_ID,
    name: "Favorite Old",
  }),
  propertyRow({
    createdAt: "2026-07-08T10:00:00.000Z",
    favoritedAt: new Date("2026-07-05T12:00:00.000Z"),
    id: FAVORITE_NEW_ID,
    name: "Favorite New",
  }),
  propertyRow({
    createdAt: "2026-07-09T10:00:00.000Z",
    favoritedAt: null,
    id: UNFAVORITE_NEW_ID,
    name: "Unfavorite New",
  }),
  propertyRow({
    createdAt: "2026-07-07T10:00:00.000Z",
    favoritedAt: null,
    id: UNFAVORITE_OLD_ID,
    name: "Unfavorite Old",
  }),
];

const mockQuery = mock((sql: string, values?: unknown[]) => {
  const limit = values?.at(-1) as number | undefined;
  const hasCursor = sql.includes("HAVING");

  let rows = SORTED_ROWS;
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

    await propertiesDb.listPaginatedForUser({ limit: 10, userId: USER_ID });

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain("COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) ASC");
    expect(sql).toContain("p.created_at DESC");
    expect(sql).toContain("p.id DESC");
  });

  test("returns nextCursor when more rows exist", async () => {
    mockQuery.mockClear();

    const firstPage = await propertiesDb.listPaginatedForUser({ limit: 2, userId: USER_ID });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.items[0]?.id).toBe(FAVORITE_OLD_ID);
    expect(firstPage.items[1]?.id).toBe(FAVORITE_NEW_ID);
    expect(firstPage.nextCursor).toBeString();
  });

  test("passes favorite-aware cursor predicate on subsequent pages", async () => {
    mockQuery.mockClear();

    const firstPage = await propertiesDb.listPaginatedForUser({ limit: 2, userId: USER_ID });
    expect(firstPage.nextCursor).toBeString();

    mockQuery.mockClear();
    await propertiesDb.listPaginatedForUser({
      cursor: firstPage.nextCursor!,
      limit: 2,
      userId: USER_ID,
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

    await propertiesDb.listPaginatedForUser({ limit: 2, q: "alpha", userId: USER_ID });

    const [sql, values] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ILIKE");
    expect(values).toContain("%alpha%");
    expect(sql).toContain("COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) ASC");
  });
});
