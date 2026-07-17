import type { Pool, PoolClient } from "pg";

import { pool } from "./pool";

type DbQueryable = Pool | PoolClient;

interface CreateTenantRefreshTokenParams {
  expiresAt: Date;
  tenantUserId: string;
  tokenHash: string;
}

interface TenantRefreshTokenRow {
  created_at: Date;
  expires_at: Date;
  id: string;
  revoked: boolean;
  tenant_user_id: string;
  token_hash: string;
}

export const tenantRefreshTokenDb = {
  async create(
    { expiresAt, tenantUserId, tokenHash }: CreateTenantRefreshTokenParams,
    db: DbQueryable = pool
  ): Promise<void> {
    await db.query(
      `INSERT INTO tenant_refresh_tokens (tenant_user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [tenantUserId, tokenHash, expiresAt]
    );
  },

  async deleteExpired(db: DbQueryable = pool): Promise<number> {
    const result = await db.query(
      "DELETE FROM tenant_refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE"
    );
    return result.rowCount ?? 0;
  },

  async findByHash(
    tokenHash: string,
    db: DbQueryable = pool
  ): Promise<TenantRefreshTokenRow | null> {
    const result = await db.query(
      `SELECT * FROM tenant_refresh_tokens
       WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [tokenHash]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as TenantRefreshTokenRow;
  },

  async revokeAllForTenantUser(tenantUserId: string, db: DbQueryable = pool): Promise<void> {
    await db.query(`UPDATE tenant_refresh_tokens SET revoked = TRUE WHERE tenant_user_id = $1`, [
      tenantUserId,
    ]);
  },

  async revokeByHash(tokenHash: string, db: DbQueryable = pool): Promise<void> {
    await db.query(`UPDATE tenant_refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [
      tokenHash,
    ]);
  },
};
