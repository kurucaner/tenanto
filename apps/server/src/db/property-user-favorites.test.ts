import { describe, expect, mock, test } from "bun:test";

const mockQuery = mock(() =>
  Promise.resolve({
    rows: [{ favorited_at: new Date("2026-07-01T12:00:00.000Z") }],
  })
);

mock.module("./pool", () => ({
  pool: { query: mockQuery },
}));

const { propertyUserFavoritesDb } = await import("./property-user-favorites");

describe("propertyUserFavoritesDb.setFavorite", () => {
  test("inserts a favorite row when favorite is true", async () => {
    mockQuery.mockClear();

    const result = await propertyUserFavoritesDb.setFavorite({
      favorite: true,
      propertyId: "prop-1",
      userId: "user-1",
    });

    expect(result.favoritedAt).toBe("2026-07-01T12:00:00.000Z");
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, values] = mockQuery.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("INSERT INTO property_user_favorites");
    expect(sql).toContain("ON CONFLICT (user_id, property_id)");
    expect(sql).toContain("DO UPDATE SET favorited_at = property_user_favorites.favorited_at");
    expect(values).toEqual(["user-1", "prop-1"]);
  });

  test("preserves existing favorited_at on conflict via no-op update", async () => {
    mockQuery.mockClear();

    await propertyUserFavoritesDb.setFavorite({
      favorite: true,
      propertyId: "prop-1",
      userId: "user-1",
    });

    const [sql] = mockQuery.mock.calls[0] as unknown as [string];
    expect(sql).not.toContain("favorited_at = NOW()");
    expect(sql).toContain("DO UPDATE SET favorited_at = property_user_favorites.favorited_at");
  });

  test("deletes the favorite row when favorite is false", async () => {
    mockQuery.mockClear();
    mockQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }));

    const result = await propertyUserFavoritesDb.setFavorite({
      favorite: false,
      propertyId: "prop-1",
      userId: "user-1",
    });

    expect(result.favoritedAt).toBeNull();
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, values] = mockQuery.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("DELETE FROM property_user_favorites");
    expect(values).toEqual(["user-1", "prop-1"]);
  });
});
