import type { Pool, PoolClient } from "pg";

import type { TPlatform } from "@/packages/shared";

import { pool } from "./pool";

type DbQueryable = Pool | PoolClient;

interface UpsertPushTokenParams {
  isActive: boolean;
  platform: TPlatform;
  token: string;
  userId: string;
}

export const pushTokenDb = {
  async countActiveByUserId(userId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS c FROM push_tokens WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    return Number(result.rows[0]?.c ?? 0);
  },

  async deactivateAllForUser(userId: string, db: DbQueryable = pool): Promise<void> {
    await db.query("UPDATE push_tokens SET is_active = false WHERE user_id = $1", [userId]);
  },

  async deactivateForUserAndToken(
    userId: string,
    token: string,
    db: DbQueryable = pool
  ): Promise<void> {
    await db.query("UPDATE push_tokens SET is_active = false WHERE user_id = $1 AND token = $2", [
      userId,
      token,
    ]);
  },

  async findActiveByUserId(userId: string): Promise<{ token: string }[]> {
    const result = await pool.query(
      `SELECT token FROM push_tokens WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    return result.rows as { token: string }[];
  },

  async upsert({ isActive, platform, token, userId }: UpsertPushTokenParams): Promise<void> {
    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform, is_active, last_used_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         is_active = EXCLUDED.is_active,
         last_used_at = CURRENT_TIMESTAMP`,
      [userId, token, platform, isActive]
    );
  },
};
