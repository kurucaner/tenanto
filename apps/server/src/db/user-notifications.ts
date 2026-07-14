import { getUserNotificationsRetentionCutoff } from "@/lib/user-notifications-retention";
import type {
  IUserNotification,
  UserNotificationResourceType,
  UserNotificationType,
} from "@/packages/shared";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";

import { pool } from "./pool";

export interface CreateUserNotificationInput {
  body: string;
  contextResourceId?: string;
  resourceId?: string;
  resourceType?: UserNotificationResourceType;
  title: string;
  type: UserNotificationType;
  userId: string;
}

function mapUserNotificationRow(row: Record<string, unknown>): IUserNotification {
  const resourceType = row.resource_type;
  return {
    body: row.body as string,
    contextResourceId: (row.context_resource_id as string) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    id: row.id as string,
    readAt: row.read_at != null ? (row.read_at as Date).toISOString() : null,
    resourceId: (row.resource_id as string) ?? null,
    resourceType:
      resourceType === "property" || resourceType === "support_request" ? resourceType : null,
    title: row.title as string,
    type: row.type as UserNotificationType,
  };
}

export const userNotificationsDb = {
  async countUnread(userId: string): Promise<number> {
    const retentionCutoff = getUserNotificationsRetentionCutoff();
    const result = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM user_notifications
       WHERE user_id = $1
         AND read_at IS NULL
         AND created_at >= $2::timestamptz`,
      [userId, retentionCutoff]
    );
    return Number(result.rows[0]?.c ?? 0);
  },

  async create(input: CreateUserNotificationInput): Promise<IUserNotification> {
    const result = await pool.query(
      `INSERT INTO user_notifications (user_id, type, title, body, resource_type, resource_id, context_resource_id)
       VALUES ($1, $2::user_notification_type, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.userId,
        input.type,
        input.title,
        input.body,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.contextResourceId ?? null,
      ]
    );
    return mapUserNotificationRow(result.rows[0] as Record<string, unknown>);
  },

  async listPaginated(params: {
    cursor?: string;
    limit: number;
    userId: string;
  }): Promise<{ items: IUserNotification[]; nextCursor: string | null }> {
    const retentionCutoff = getUserNotificationsRetentionCutoff();
    const fragments: string[] = [`user_id = $1`, `created_at >= $2::timestamptz`];
    const values: unknown[] = [params.userId, retentionCutoff];
    let p = 3;

    if (params.cursor != null && params.cursor !== "") {
      const decoded = decodeKeysetCursor(params.cursor);
      fragments.push(`(created_at, id) < ($${p++}::timestamptz, $${p++}::uuid)`);
      values.push(decoded.createdAt, decoded.id);
    }

    const limitParam = p;
    values.push(params.limit + 1);

    const result = await pool.query(
      `SELECT *
       FROM user_notifications
       WHERE ${fragments.join(" AND ")}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, params.limit, (last) =>
      encodeKeysetCursor(last.created_at as Date, last.id as string)
    );
    return { items: pageRows.map(mapUserNotificationRow), nextCursor };
  },

  async markAllRead(userId: string): Promise<number> {
    const result = await pool.query(
      `UPDATE user_notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return result.rowCount ?? 0;
  },

  async markRead(userId: string, id: string): Promise<IUserNotification | null> {
    const result = await pool.query(
      `UPDATE user_notifications
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    if (result.rows.length === 0) return null;
    return mapUserNotificationRow(result.rows[0] as Record<string, unknown>);
  },
};
