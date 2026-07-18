import { describe, expect, mock, test } from "bun:test";

import { mockAsyncFn } from "@/test-fixtures/mocks";

const PROPERTY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const mockQuery = mockAsyncFn((_sql: string, _values?: unknown[]) =>
  Promise.resolve({
    rows: [
      {
        address: "123 Main St",
        created_at: new Date("2026-07-09T10:00:00.000Z"),
        created_by: USER_ID,
        favorited_at: new Date("2026-07-01T12:00:00.000Z"),
        id: PROPERTY_ID,
        legal_name: null,
        member_count: 1,
        name: "Alpha",
        phone_number: null,
        unit_count: 2,
        updated_at: new Date("2026-07-09T10:00:00.000Z"),
      },
    ],
  })
);

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { mapPropertyRow } = await import("./mappers");
const { propertiesDb } = await import("./properties");

describe("mapPropertyRow favorites", () => {
  test("maps favorited_at to isFavorite and favoritedAt", () => {
    const property = mapPropertyRow({
      address: "123 Main St",
      created_at: new Date("2026-07-09T10:00:00.000Z"),
      created_by: USER_ID,
      favorited_at: new Date("2026-07-01T12:00:00.000Z"),
      id: PROPERTY_ID,
      legal_name: null,
      member_count: 1,
      name: "Alpha",
      phone_number: null,
      unit_count: 2,
      updated_at: new Date("2026-07-09T10:00:00.000Z"),
    });

    expect(property.isFavorite).toBe(true);
    expect(property.favoritedAt).toBe("2026-07-01T12:00:00.000Z");
  });

  test("defaults to not favorited when favorited_at is absent", () => {
    const property = mapPropertyRow({
      address: "123 Main St",
      created_at: new Date("2026-07-09T10:00:00.000Z"),
      created_by: USER_ID,
      id: PROPERTY_ID,
      legal_name: null,
      member_count: 1,
      name: "Alpha",
      phone_number: null,
      unit_count: 2,
      updated_at: new Date("2026-07-09T10:00:00.000Z"),
    });

    expect(property.isFavorite).toBe(false);
    expect(property.favoritedAt).toBeNull();
  });
});

describe("propertiesDb list favorites", () => {
  test("joins property_user_favorites for user-scoped list queries", async () => {
    mockQuery.mockClear();

    const page = await propertiesDb.listPaginatedForUser({
      limit: 10,
      userId: USER_ID,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.isFavorite).toBe(true);
    expect(page.items[0]?.favoritedAt).toBe("2026-07-01T12:00:00.000Z");

    const [sql, values] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("property_user_favorites");
    expect(sql).toContain("MAX(puf.favorited_at) AS favorited_at");
    expect(sql).toContain("COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) ASC");
    expect(sql).toContain("p.created_at DESC");
    expect(sql).toContain("p.id DESC");
    expect(values?.[0]).toBe(USER_ID);
  });

  test("joins favorites for admin list queries", async () => {
    mockQuery.mockClear();

    await propertiesDb.listPaginatedForAdmin({
      limit: 10,
      userId: USER_ID,
    });

    const [sql, values] = mockQuery.mock.calls[0]!;
    expect(sql).toContain("property_user_favorites");
    expect(values?.[0]).toBe(USER_ID);
  });
});
