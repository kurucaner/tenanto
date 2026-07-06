import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import type { ISupportAttachment } from "@/packages/shared";
import { generateDownloadUrl } from "@/s3/s3-commands";

import { pool } from "./pool";

export interface SupportMessageAttachmentInsert {
  contentType: string;
  filename: string;
  key: string;
  sizeBytes: number;
}

interface SupportMessageAttachmentRow {
  content_type: string;
  filename: string;
  id: string;
  size_bytes: number;
  storage_key: string;
  support_message_id: string;
}

export function buildSupportAttachmentStorageKey(userId: string): string {
  return `support/${userId}/${randomUUID()}`;
}

export function isSupportAttachmentKeyOwnedByUser(key: string, userId: string): boolean {
  return key.startsWith(`support/${userId}/`);
}

async function mapRowsToSupportAttachments(
  rows: SupportMessageAttachmentRow[]
): Promise<ISupportAttachment[]> {
  return Promise.all(
    rows.map(async (row) => ({
      contentType: row.content_type,
      downloadUrl: await generateDownloadUrl(row.storage_key),
      filename: row.filename,
      id: row.id,
      sizeBytes: row.size_bytes,
    }))
  );
}

export const supportMessageAttachmentsDb = {
  async createMany(
    params: {
      attachments: SupportMessageAttachmentInsert[];
      supportMessageId: string;
    },
    client: PoolClient
  ): Promise<void> {
    if (params.attachments.length === 0) return;

    for (const attachment of params.attachments) {
      await client.query(
        `INSERT INTO support_message_attachments
           (support_message_id, storage_key, filename, content_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          params.supportMessageId,
          attachment.key,
          attachment.filename,
          attachment.contentType,
          attachment.sizeBytes,
        ]
      );
    }
  },

  async listByMessageId(supportMessageId: string): Promise<ISupportAttachment[]> {
    const result = await pool.query(
      `SELECT id, support_message_id, storage_key, filename, content_type, size_bytes
       FROM support_message_attachments
       WHERE support_message_id = $1
       ORDER BY created_at ASC, id ASC`,
      [supportMessageId]
    );
    return mapRowsToSupportAttachments(result.rows as SupportMessageAttachmentRow[]);
  },

  async listByMessageIds(messageIds: string[]): Promise<Map<string, ISupportAttachment[]>> {
    const grouped = new Map<string, ISupportAttachment[]>();
    if (messageIds.length === 0) return grouped;

    const result = await pool.query(
      `SELECT id, support_message_id, storage_key, filename, content_type, size_bytes
       FROM support_message_attachments
       WHERE support_message_id = ANY($1::uuid[])
       ORDER BY created_at ASC, id ASC`,
      [messageIds]
    );

    const rowsByMessageId = new Map<string, SupportMessageAttachmentRow[]>();
    for (const row of result.rows as SupportMessageAttachmentRow[]) {
      const existing = rowsByMessageId.get(row.support_message_id) ?? [];
      existing.push(row);
      rowsByMessageId.set(row.support_message_id, existing);
    }

    await Promise.all(
      [...rowsByMessageId.entries()].map(async ([messageId, rows]) => {
        grouped.set(messageId, await mapRowsToSupportAttachments(rows));
      })
    );

    return grouped;
  },
};
