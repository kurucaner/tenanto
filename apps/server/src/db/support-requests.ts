import type {
  IAdminSupportRequestListItem,
  ISupportRequest,
  ISupportRequestDetail,
  ISupportRequestListItem,
  SupportCategory,
  SupportRequestStatus,
  TAdminSupportRequestSettableStatus,
} from "@/packages/shared";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";

import { mapSupportRequestRow } from "./mappers";
import { pool } from "./pool";
import {
  supportMessageAttachmentsDb,
  type SupportMessageAttachmentInsert,
} from "./support-message-attachments";
import { supportMessagesDb } from "./support-messages";

export interface CreateSupportRequestInput {
  attachments?: SupportMessageAttachmentInsert[];
  category: SupportCategory;
  message: string;
  userId: string;
}

const LIST_AGGREGATES = `
  (SELECT sm.body
   FROM support_messages sm
   WHERE sm.support_request_id = sr.id
   ORDER BY sm.created_at DESC, sm.id DESC
   LIMIT 1) AS last_message_preview,
  (SELECT COUNT(*)::int
   FROM support_messages sm
   WHERE sm.support_request_id = sr.id) AS message_count
`;

function mapSupportRequestListRow(row: Record<string, unknown>): ISupportRequestListItem {
  const base = mapSupportRequestRow(row);
  return {
    ...base,
    lastMessagePreview: (row.last_message_preview as string) ?? "",
    messageCount: (row.message_count as number) ?? 0,
  };
}

function mapAdminSupportRequestListRow(row: Record<string, unknown>): IAdminSupportRequestListItem {
  return {
    ...mapSupportRequestListRow(row),
    submitterEmail: row.submitter_email as string,
    submitterName: row.submitter_name as string,
  };
}

function buildListFilters(params: {
  category?: SupportCategory;
  cursor?: string;
  status?: SupportRequestStatus;
  userId?: string;
}): { fragments: string[]; values: unknown[] } {
  const fragments: string[] = [];
  const values: unknown[] = [];
  let p = 1;

  if (params.userId != null) {
    fragments.push(`sr.user_id = $${p++}`);
    values.push(params.userId);
  }
  if (params.status != null) {
    fragments.push(`sr.status = $${p++}::support_request_status`);
    values.push(params.status);
  }
  if (params.category != null) {
    fragments.push(`sr.category = $${p++}::support_category`);
    values.push(params.category);
  }
  if (params.cursor != null && params.cursor !== "") {
    const decoded = decodeKeysetCursor(params.cursor);
    fragments.push(`(sr.created_at, sr.id) < ($${p++}::timestamptz, $${p++}::uuid)`);
    values.push(decoded.createdAt, decoded.id);
  }

  return { fragments, values };
}

export const supportRequestsDb = {
  async createWithInitialMessage(input: CreateSupportRequestInput): Promise<ISupportRequestDetail> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ticketResult = await client.query(
        `INSERT INTO support_requests (user_id, category)
         VALUES ($1, $2)
         RETURNING *`,
        [input.userId, input.category]
      );
      const ticket = mapSupportRequestRow(ticketResult.rows[0] as Record<string, unknown>);
      const messageResult = await client.query(
        `INSERT INTO support_messages (support_request_id, author_user_id, body)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [ticket.id, input.userId, input.message]
      );
      const authorResult = await client.query(`SELECT name, email FROM users WHERE id = $1`, [
        input.userId,
      ]);
      const authorRow = authorResult.rows[0] as Record<string, unknown>;
      const messageRow = messageResult.rows[0] as Record<string, unknown>;
      const messageId = messageRow.id as string;

      if (input.attachments != null && input.attachments.length > 0) {
        await supportMessageAttachmentsDb.createMany(
          {
            attachments: input.attachments,
            supportMessageId: messageId,
          },
          client
        );
      }

      await client.query("COMMIT");

      const attachments = await supportMessageAttachmentsDb.listByMessageId(messageId);

      return {
        item: ticket,
        messages: [
          {
            attachments,
            authorEmail: authorRow.email as string,
            authorName: authorRow.name as string,
            authorUserId: input.userId,
            body: messageRow.body as string,
            createdAt: (messageRow.created_at as Date).toISOString(),
            id: messageId,
          },
        ],
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async findById(id: string): Promise<ISupportRequest | null> {
    const result = await pool.query(`SELECT * FROM support_requests WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapSupportRequestRow(result.rows[0] as Record<string, unknown>);
  },

  async findDetailByIdForAdmin(id: string): Promise<ISupportRequestDetail | null> {
    const ticket = await supportRequestsDb.findById(id);
    if (ticket == null) return null;
    const messages = await supportMessagesDb.listByRequestId(id);
    return { item: ticket, messages };
  },

  async findDetailByIdForUser(id: string, userId: string): Promise<ISupportRequestDetail | null> {
    const ticket = await supportRequestsDb.findById(id);
    if (ticket == null || ticket.userId !== userId) return null;
    const messages = await supportMessagesDb.listByRequestId(id);
    return { item: ticket, messages };
  },

  async findListItemByIdForAdmin(id: string): Promise<IAdminSupportRequestListItem | null> {
    const result = await pool.query(
      `SELECT sr.*, u.email AS submitter_email, u.name AS submitter_name, ${LIST_AGGREGATES}
       FROM support_requests sr
       INNER JOIN users u ON u.id = sr.user_id
       WHERE sr.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return mapAdminSupportRequestListRow(result.rows[0] as Record<string, unknown>);
  },

  async listPaginatedForAdmin(params: {
    category?: SupportCategory;
    cursor?: string;
    limit: number;
    status?: SupportRequestStatus;
  }): Promise<{ items: IAdminSupportRequestListItem[]; nextCursor: string | null }> {
    const { fragments, values } = buildListFilters(params);
    const whereClause = fragments.length > 0 ? `WHERE ${fragments.join(" AND ")}` : "";
    const limitParam = values.length + 1;
    values.push(params.limit + 1);

    const result = await pool.query(
      `SELECT sr.*, u.email AS submitter_email, u.name AS submitter_name, ${LIST_AGGREGATES}
       FROM support_requests sr
       INNER JOIN users u ON u.id = sr.user_id
       ${whereClause}
       ORDER BY sr.created_at DESC, sr.id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, params.limit, (last) =>
      encodeKeysetCursor(last.created_at as Date, last.id as string)
    );
    return { items: pageRows.map(mapAdminSupportRequestListRow), nextCursor };
  },

  async listPaginatedForUser(params: {
    category?: SupportCategory;
    cursor?: string;
    limit: number;
    status?: SupportRequestStatus;
    userId: string;
  }): Promise<{ items: ISupportRequestListItem[]; nextCursor: string | null }> {
    const { fragments, values } = buildListFilters(params);
    const whereClause = fragments.length > 0 ? `WHERE ${fragments.join(" AND ")}` : "";
    const limitParam = values.length + 1;
    values.push(params.limit + 1);

    const result = await pool.query(
      `SELECT sr.*, ${LIST_AGGREGATES}
       FROM support_requests sr
       ${whereClause}
       ORDER BY sr.created_at DESC, sr.id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, params.limit, (last) =>
      encodeKeysetCursor(last.created_at as Date, last.id as string)
    );
    return { items: pageRows.map(mapSupportRequestListRow), nextCursor };
  },

  async updateSettableStatusForAdmin(
    id: string,
    status: TAdminSupportRequestSettableStatus
  ): Promise<IAdminSupportRequestListItem | null> {
    const updated = await supportRequestsDb.updateStatus(id, status);
    if (!updated) return null;
    return supportRequestsDb.findListItemByIdForAdmin(id);
  },

  async updateStatus(id: string, status: SupportRequestStatus): Promise<ISupportRequest | null> {
    const result = await pool.query(
      `UPDATE support_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) return null;
    return mapSupportRequestRow(result.rows[0] as Record<string, unknown>);
  },
};
