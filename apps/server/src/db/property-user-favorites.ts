import type { Pool, PoolClient } from "pg";

import { pool } from "./pool";

type DbQueryable = Pool | PoolClient;

export const propertyUserFavoritesDb = {
  async setFavorite(
    params: { favorite: boolean; propertyId: string; userId: string },
    queryable: DbQueryable = pool
  ): Promise<{ favoritedAt: string | null }> {
    if (params.favorite) {
      const result = await queryable.query(
        `INSERT INTO property_user_favorites (user_id, property_id, favorited_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, property_id)
         DO UPDATE SET favorited_at = property_user_favorites.favorited_at
         RETURNING favorited_at`,
        [params.userId, params.propertyId]
      );
      const favoritedAt = (result.rows[0] as { favorited_at: Date }).favorited_at.toISOString();
      return { favoritedAt };
    }

    await queryable.query(
      `DELETE FROM property_user_favorites WHERE user_id = $1 AND property_id = $2`,
      [params.userId, params.propertyId]
    );
    return { favoritedAt: null };
  },
};
