import { pool } from "./pool";

export interface ITenantSmsKeywordEvent {
  createdAt: string;
  id: string;
  keyword: string;
  payloadSnippet: string | null;
  phone: string;
  tenantUserId: string | null;
}

const MAX_PAYLOAD_SNIPPET_LENGTH = 2000;

export function truncatePayloadSnippet(payload: unknown): string | null {
  if (payload == null) {
    return null;
  }

  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  if (serialized.length <= MAX_PAYLOAD_SNIPPET_LENGTH) {
    return serialized;
  }

  return `${serialized.slice(0, MAX_PAYLOAD_SNIPPET_LENGTH - 1)}…`;
}

function mapRow(row: Record<string, unknown>): ITenantSmsKeywordEvent {
  return {
    createdAt: (row.created_at as Date).toISOString(),
    id: row.id as string,
    keyword: row.keyword as string,
    payloadSnippet: (row.payload_snippet as string | null) ?? null,
    phone: row.phone as string,
    tenantUserId: (row.tenant_user_id as string | null) ?? null,
  };
}

export const tenantSmsKeywordEventsDb = {
  async insert(input: {
    keyword: string;
    payloadSnippet: string | null;
    phone: string;
    tenantUserId: string | null;
  }): Promise<ITenantSmsKeywordEvent> {
    const result = await pool.query(
      `INSERT INTO tenant_sms_keyword_events (phone, keyword, tenant_user_id, payload_snippet)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.phone, input.keyword, input.tenantUserId, input.payloadSnippet]
    );

    return mapRow(result.rows[0] as Record<string, unknown>);
  },
};
