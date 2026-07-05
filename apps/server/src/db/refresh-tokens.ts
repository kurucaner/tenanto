import type { Pool, PoolClient } from "pg";

import { pool } from "./pool";

type DbQueryable = Pool | PoolClient;

interface CreateRefreshTokenParams {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
}

interface RefreshTokenRow {
  created_at: Date;
  expires_at: Date;
  id: string;
  revoked: boolean;
  token_hash: string;
  user_id: string;
}

export const refreshTokenDb = {
  async create({ expiresAt, tokenHash, userId }: CreateRefreshTokenParams): Promise<void> {
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  },

  async deleteExpired(): Promise<number> {
    const result = await pool.query(
      "DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE"
    );
    return result.rowCount ?? 0;
  },

  async findByHash(tokenHash: string, db: DbQueryable = pool): Promise<RefreshTokenRow | null> {
    const result = await db.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [tokenHash]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as RefreshTokenRow;
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await pool.query("UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1", [userId]);
  },

  async revokeByHash(tokenHash: string, db: DbQueryable = pool): Promise<void> {
    await db.query("UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1", [tokenHash]);
  },
};
