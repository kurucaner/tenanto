import type {
  IAdminSupportRequestListItem,
  ISupportRequest,
  SupportCategory,
  SupportRequestStatus,
  TAdminSupportRequestSettableStatus,
} from "@/packages/shared";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";

import { mapSupportRequestRow } from "./mappers";
import { pool } from "./pool";

export interface CreateSupportRequestInput {
  category: SupportCategory;
  message: string;
  userId: string;
}

function mapAdminSupportRequestListRow(row: Record<string, unknown>): IAdminSupportRequestListItem {
  const base = mapSupportRequestRow(row);
  return {
    ...base,
    submitterEmail: row.submitter_email as string,
    submitterName: row.submitter_name as string,
  };
}

export const supportRequestsDb = {
  async create(input: CreateSupportRequestInput): Promise<ISupportRequest> {
    const result = await pool.query(
      `INSERT INTO support_requests (user_id, category, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.userId, input.category, input.message]
    );
    return mapSupportRequestRow(result.rows[0]);
  },

  async findAll(filters?: { status?: SupportRequestStatus }): Promise<ISupportRequest[]> {
    if (filters?.status) {
      const result = await pool.query(
        "SELECT * FROM support_requests WHERE status = $1 ORDER BY created_at DESC",
        [filters.status]
      );
      return result.rows.map((row) => mapSupportRequestRow(row));
    }
    const result = await pool.query("SELECT * FROM support_requests ORDER BY created_at DESC");
    return result.rows.map((row) => mapSupportRequestRow(row));
  },

  async findByUserId(userId: string): Promise<ISupportRequest[]> {
    const result = await pool.query(
      "SELECT * FROM support_requests WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    return result.rows.map((row) => mapSupportRequestRow(row));
  },

  async findListItemByIdForAdmin(id: string): Promise<IAdminSupportRequestListItem | null> {
    const result = await pool.query(
      `SELECT sr.*, u.email AS submitter_email, u.name AS submitter_name
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
    const fragments: string[] = [];
    const values: unknown[] = [];
    let p = 1;

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

    const whereClause = fragments.length > 0 ? `WHERE ${fragments.join(" AND ")}` : "";
    const limitParam = p;
    values.push(params.limit + 1);

    const result = await pool.query(
      `SELECT sr.*, u.email AS submitter_email, u.name AS submitter_name
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
    const items = pageRows.map(mapAdminSupportRequestListRow);
    return { items, nextCursor };
  },

  async updateSettableStatusForAdmin(
    id: string,
    status: TAdminSupportRequestSettableStatus
  ): Promise<IAdminSupportRequestListItem | null> {
    const updated = await supportRequestsDb.updateStatus(id, status);
    if (!updated) return null;
    const item = await supportRequestsDb.findListItemByIdForAdmin(id);
    return item;
  },

  async updateStatus(id: string, status: SupportRequestStatus): Promise<ISupportRequest | null> {
    const result = await pool.query(
      `UPDATE support_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) return null;
    return mapSupportRequestRow(result.rows[0]);
  },
};
