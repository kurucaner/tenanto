import type { ISupportMessage } from "@/packages/shared";

import { pool } from "./pool";

function mapSupportMessageRow(row: Record<string, unknown>): ISupportMessage {
  return {
    authorEmail: row.author_email as string,
    authorName: row.author_name as string,
    authorUserId: row.author_user_id as string,
    body: row.body as string,
    createdAt: (row.created_at as Date).toISOString(),
    id: row.id as string,
  };
}

export const supportMessagesDb = {
  async create(params: {
    authorUserId: string;
    body: string;
    supportRequestId: string;
  }): Promise<ISupportMessage> {
    const result = await pool.query(
      `INSERT INTO support_messages (support_request_id, author_user_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [params.supportRequestId, params.authorUserId, params.body]
    );
    const author = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [
      params.authorUserId,
    ]);
    const authorRow = author.rows[0] as Record<string, unknown>;
    return mapSupportMessageRow({
      ...result.rows[0],
      author_email: authorRow.email,
      author_name: authorRow.name,
    });
  },

  async listByRequestId(supportRequestId: string): Promise<ISupportMessage[]> {
    const result = await pool.query(
      `SELECT sm.*, u.email AS author_email, u.name AS author_name
       FROM support_messages sm
       INNER JOIN users u ON u.id = sm.author_user_id
       WHERE sm.support_request_id = $1
       ORDER BY sm.created_at ASC, sm.id ASC`,
      [supportRequestId]
    );
    return result.rows.map((row) => mapSupportMessageRow(row as Record<string, unknown>));
  },
};
