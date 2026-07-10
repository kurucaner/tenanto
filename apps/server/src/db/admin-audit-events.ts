import type { Pool, PoolClient } from "pg";

import { type IAdminAuditEvent, type IAdminAuditEventsListQuery } from "@/packages/shared";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";

import { pool } from "./pool";

/** node-pg returns INET as string; avoid String(object) for unknown row values. */
function inetColumnToString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return null;
}

function mapRow(row: Record<string, unknown>): IAdminAuditEvent {
  return {
    action: row.action as string,
    actorEmail: row.actor_email as string,
    actorUserId: row.actor_user_id == null ? null : (row.actor_user_id as string),
    createdAt: (row.created_at as Date).toISOString(),
    id: row.id as string,
    ipAddress: inetColumnToString(row.ip_address),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    resourceId: row.resource_id == null ? null : (row.resource_id as string),
    resourceType: row.resource_type as string,
    userAgent: row.user_agent == null ? null : (row.user_agent as string),
  };
}

export interface IInsertAdminAuditEventParams {
  action: string;
  actorEmail: string;
  actorUserId: string;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  resourceId: string | null;
  resourceType: string;
  userAgent: string | null;
}

export const adminAuditEventsDb = {
  async insert(client: PoolClient, params: IInsertAdminAuditEventParams): Promise<void> {
    await client.query(
      `INSERT INTO admin_audit_events (
        actor_user_id, actor_email, action, resource_type, resource_id, metadata, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::inet, $8)`,
      [
        params.actorUserId,
        params.actorEmail,
        params.action,
        params.resourceType,
        params.resourceId,
        JSON.stringify(params.metadata),
        params.ipAddress,
        params.userAgent,
      ]
    );
  },

  async listPaginated(
    db: Pool | PoolClient,
    query: IAdminAuditEventsListQuery & { limit: number }
  ): Promise<{ events: IAdminAuditEvent[]; nextCursor: string | null }> {
    const fragments: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (query.resource_type != null && query.resource_type !== "") {
      fragments.push(`resource_type = $${p++}`);
      values.push(query.resource_type);
    }

    if (query.resource_id != null && query.resource_id !== "") {
      fragments.push(`resource_id = $${p++}::uuid`);
      values.push(query.resource_id);
    }

    if (query.actor_user_id != null && query.actor_user_id !== "") {
      fragments.push(`actor_user_id = $${p++}::uuid`);
      values.push(query.actor_user_id);
    }

    if (query.cursor != null && query.cursor !== "") {
      const cur = decodeKeysetCursor(query.cursor);
      fragments.push(`(created_at, id) < ($${p++}::timestamptz, $${p++}::uuid)`);
      values.push(cur.createdAt, cur.id);
    }

    const whereClause = fragments.length > 0 ? `WHERE ${fragments.join(" AND ")}` : "";
    const limitParam = p;
    values.push(query.limit + 1);

    const result = await db.query(
      `SELECT * FROM admin_audit_events
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows;
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, query.limit, (last) =>
      encodeKeysetCursor(last.created_at as Date, last.id as string)
    );
    const events = pageRows.map((row) => mapRow(row as Record<string, unknown>));

    return { events, nextCursor };
  },

  /** List using the shared pool (read paths). */
  async listPaginatedFromPool(
    query: IAdminAuditEventsListQuery & { limit: number }
  ): Promise<{ events: IAdminAuditEvent[]; nextCursor: string | null }> {
    return adminAuditEventsDb.listPaginated(pool, query);
  },
};
