import type { PoolClient } from "pg";

import { pool } from "./pool";

export type SupportStagedUploadStatus = "confirmed" | "linked" | "pending";

interface SupportStagedUploadRow {
  confirmed_at: Date | null;
  content_type: string;
  created_at: Date;
  filename: string;
  linked_at: Date | null;
  size_bytes: number;
  status: SupportStagedUploadStatus;
  storage_key: string;
  user_id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUserIdFromSupportKey(key: string): string | null {
  const segments = key.split("/");
  if (segments.length < 3 || segments[0] !== "support") return null;
  const userId = segments[1];
  return userId != null && UUID_RE.test(userId) ? userId : null;
}

export const supportStagedUploadsDb = {
  async areConfirmedForUser(userId: string, keys: string[]): Promise<boolean> {
    if (keys.length === 0) return true;

    const statuses = await supportStagedUploadsDb.findByKeysForUser(userId, keys);
    if (statuses.size !== keys.length) return false;

    return keys.every((key) => {
      const status = statuses.get(key);
      return status === "confirmed" || status === "linked";
    });
  },

  async confirmByKey(key: string, sizeBytesFromEvent?: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE support_staged_uploads
       SET status = 'confirmed',
           confirmed_at = COALESCE(confirmed_at, CURRENT_TIMESTAMP),
           size_bytes = COALESCE($2, size_bytes)
       WHERE storage_key = $1
         AND status IN ('pending', 'confirmed')
       RETURNING storage_key`,
      [key, sizeBytesFromEvent ?? null]
    );
    return result.rowCount != null && result.rowCount > 0;
  },

  async createPending(params: {
    contentType: string;
    filename: string;
    key: string;
    sizeBytes: number;
    userId: string;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO support_staged_uploads
         (storage_key, user_id, filename, content_type, size_bytes, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (storage_key) DO NOTHING`,
      [params.key, params.userId, params.filename, params.contentType, params.sizeBytes]
    );
  },

  async findByKeysForUser(
    userId: string,
    keys: string[]
  ): Promise<Map<string, SupportStagedUploadStatus>> {
    const statuses = new Map<string, SupportStagedUploadStatus>();
    if (keys.length === 0) return statuses;

    const result = await pool.query(
      `SELECT storage_key, status
       FROM support_staged_uploads
       WHERE user_id = $1
         AND storage_key = ANY($2::text[])`,
      [userId, keys]
    );

    for (const row of result.rows as Pick<SupportStagedUploadRow, "status" | "storage_key">[]) {
      statuses.set(row.storage_key, row.status);
    }

    return statuses;
  },

  async markLinked(keys: string[], client?: PoolClient): Promise<void> {
    if (keys.length === 0) return;
    const executor = client ?? pool;
    await executor.query(
      `UPDATE support_staged_uploads
       SET status = 'linked',
           linked_at = COALESCE(linked_at, CURRENT_TIMESTAMP)
       WHERE storage_key = ANY($1::text[])
         AND status IN ('pending', 'confirmed', 'linked')`,
      [keys]
    );
  },
};
