import type { ISupportMessage } from "@/packages/shared";

import { pool } from "./pool";
import {
  type SupportMessageAttachmentInsert,
  supportMessageAttachmentsDb,
} from "./support-message-attachments";
import { supportStagedUploadsDb } from "./support-staged-uploads";

function mapSupportMessageRow(row: Record<string, unknown>): Omit<ISupportMessage, "attachments"> {
  return {
    authorEmail: row.author_email as string,
    authorName: row.author_name as string,
    authorUserId: row.author_user_id as string,
    body: row.body as string,
    createdAt: (row.created_at as Date).toISOString(),
    id: row.id as string,
  };
}

async function attachMessageAttachments(messages: Omit<ISupportMessage, "attachments">[]) {
  if (messages.length === 0) return [] as ISupportMessage[];

  const attachmentsByMessageId = await supportMessageAttachmentsDb.listByMessageIds(
    messages.map((message) => message.id)
  );

  return messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessageId.get(message.id) ?? [],
  }));
}

export const supportMessagesDb = {
  async create(params: {
    attachments?: SupportMessageAttachmentInsert[];
    authorUserId: string;
    body: string;
    supportRequestId: string;
  }): Promise<ISupportMessage> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO support_messages (support_request_id, author_user_id, body)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [params.supportRequestId, params.authorUserId, params.body]
      );
      const messageRow = result.rows[0] as Record<string, unknown>;
      const messageId = messageRow.id as string;

      if (params.attachments != null && params.attachments.length > 0) {
        await supportStagedUploadsDb.markLinked(
          params.attachments.map((attachment) => attachment.key),
          client
        );
        await supportMessageAttachmentsDb.createMany(
          {
            attachments: params.attachments,
            supportMessageId: messageId,
          },
          client
        );
      }

      await client.query("COMMIT");

      const author = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [
        params.authorUserId,
      ]);
      const authorRow = author.rows[0] as Record<string, unknown>;
      const base = mapSupportMessageRow({
        ...messageRow,
        author_email: authorRow.email,
        author_name: authorRow.name,
      });
      const attachments = await supportMessageAttachmentsDb.listByMessageId(messageId);
      return { ...base, attachments };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
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
    const messages = result.rows.map((row) => mapSupportMessageRow(row as Record<string, unknown>));
    return attachMessageAttachments(messages);
  },
};
