import { didTenantEmailCampaignTransitionToTerminal } from "@/lib/tenant-email-campaign-limits";
import type {
  ITenantEmailCampaign,
  ITenantEmailCampaignListItem,
  ITenantEmailCampaignRecipient,
  ITenantEmailCampaignsListMeta,
  ITenantEmailResolvedRecipient,
  ITenantEmailSkippedRecipient,
  TTenantEmailCampaignsListFilters,
  TTenantEmailCampaignStatus,
  TTenantEmailRecipientStatus,
  TTenantEmailTenantRole,
} from "@/packages/shared";
import { toIso } from "@/packages/shared";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";
import { shouldIncludeListMeta } from "@/pagination/should-include-list-meta";

import { isPostgresUniqueViolation } from "./pg-errors";
import { pool } from "./pool";

export interface ICreateTenantEmailCampaignInput {
  createdBy: string;
  htmlBody: string;
  idempotencyKey: string;
  propertyId: string;
  recipients: ITenantEmailResolvedRecipient[];
  skipped: ITenantEmailSkippedRecipient[];
  subject: string;
  textBody: string;
}

export interface ITenantEmailSendRecipientRow {
  campaignId: string;
  email: string;
  htmlBody: string;
  propertyId: string;
  propertyName: string;
  recipientId: string;
  status: TTenantEmailRecipientStatus;
  subject: string;
  textBody: string;
}

function mapCampaignRow(row: Record<string, unknown>): ITenantEmailCampaign {
  return {
    completedAt: toIso(row.completed_at),
    createdAt: (row.created_at as Date).toISOString(),
    createdBy: row.created_by as string,
    failedCount: row.failed_count as number,
    htmlBody: row.html_body as string,
    id: row.id as string,
    idempotencyKey: row.idempotency_key as string,
    propertyId: row.property_id as string,
    recipientCount: row.recipient_count as number,
    sentCount: row.sent_count as number,
    skippedCount: row.skipped_count as number,
    status: row.status as TTenantEmailCampaignStatus,
    subject: row.subject as string,
    textBody: row.text_body as string,
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function mapCampaignListItemRow(row: Record<string, unknown>): ITenantEmailCampaignListItem {
  return {
    completedAt: toIso(row.completed_at),
    createdAt: (row.created_at as Date).toISOString(),
    createdBy: row.created_by as string,
    failedCount: row.failed_count as number,
    id: row.id as string,
    idempotencyKey: row.idempotency_key as string,
    propertyId: row.property_id as string,
    recipientCount: row.recipient_count as number,
    sentCount: row.sent_count as number,
    skippedCount: row.skipped_count as number,
    status: row.status as TTenantEmailCampaignStatus,
    subject: row.subject as string,
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

const CAMPAIGN_LIST_SELECT = `SELECT
  id,
  property_id,
  created_by,
  subject,
  status,
  recipient_count,
  sent_count,
  failed_count,
  skipped_count,
  idempotency_key,
  completed_at,
  created_at,
  updated_at
FROM property_tenant_email_campaigns`;

function buildCampaignListConditions(
  propertyId: string,
  filters: TTenantEmailCampaignsListFilters
): { conditions: string[]; values: unknown[] } {
  const conditions = ["property_id = $1"];
  const values: unknown[] = [propertyId];
  let p = 2;

  const qTrim = filters.q?.trim();
  if (qTrim) {
    conditions.push(`subject ILIKE $${p++}`);
    values.push(`%${qTrim}%`);
  }

  return { conditions, values };
}

function mapRecipientRow(row: Record<string, unknown>): ITenantEmailCampaignRecipient {
  return {
    attempts: row.attempts as number,
    campaignId: row.campaign_id as string,
    email: row.email as string,
    id: row.id as string,
    lastError: (row.last_error as string | null) ?? null,
    leaseId: row.lease_id as string,
    sentAt: toIso(row.sent_at),
    status: row.status as TTenantEmailRecipientStatus,
    tenantName: row.tenant_name as string,
    tenantRole: row.tenant_role as TTenantEmailTenantRole,
  };
}

export class TenantEmailCampaignIdempotencyConflictError extends Error {
  constructor(public readonly existingCampaignId: string) {
    super("Tenant email campaign idempotency conflict");
    this.name = "TenantEmailCampaignIdempotencyConflictError";
  }
}

export const propertyTenantEmailCampaignsDb = {
  async createCampaignWithRecipients(
    input: ICreateTenantEmailCampaignInput
  ): Promise<{ campaign: ITenantEmailCampaign; queuedRecipientIds: string[] }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const campaignResult = await client.query(
        `INSERT INTO property_tenant_email_campaigns (
          property_id,
          created_by,
          subject,
          html_body,
          text_body,
          status,
          recipient_count,
          skipped_count,
          idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, $8)
        RETURNING *`,
        [
          input.propertyId,
          input.createdBy,
          input.subject,
          input.htmlBody,
          input.textBody,
          input.recipients.length + input.skipped.length,
          input.skipped.length,
          input.idempotencyKey,
        ]
      );

      const campaign = mapCampaignRow(campaignResult.rows[0] as Record<string, unknown>);
      const queuedRecipientIds: string[] = [];

      for (const recipient of input.recipients) {
        const recipientResult = await client.query(
          `INSERT INTO property_tenant_email_recipients (
            campaign_id,
            lease_id,
            tenant_role,
            tenant_name,
            email,
            status
          ) VALUES ($1, $2, $3, $4, $5, 'queued')
          RETURNING id`,
          [
            campaign.id,
            recipient.leaseId,
            recipient.tenantRole,
            recipient.tenantName,
            recipient.email,
          ]
        );
        queuedRecipientIds.push((recipientResult.rows[0] as { id: string }).id);
      }

      for (const skipped of input.skipped) {
        await client.query(
          `INSERT INTO property_tenant_email_recipients (
            campaign_id,
            lease_id,
            tenant_role,
            tenant_name,
            email,
            status,
            last_error
          ) VALUES ($1, $2, $3, $4, $5, 'skipped', $6)`,
          [campaign.id, skipped.leaseId, skipped.tenantRole, skipped.tenantName, "", skipped.reason]
        );
      }

      await client.query("COMMIT");

      return { campaign, queuedRecipientIds };
    } catch (error) {
      await client.query("ROLLBACK");

      if (isPostgresUniqueViolation(error)) {
        const existing = await propertyTenantEmailCampaignsDb.findByIdempotencyKey(
          input.propertyId,
          input.idempotencyKey
        );
        if (existing) {
          throw new TenantEmailCampaignIdempotencyConflictError(existing.id);
        }
      }

      throw error;
    } finally {
      client.release();
    }
  },

  async findById(campaignId: string): Promise<ITenantEmailCampaign | null> {
    const result = await pool.query(`SELECT * FROM property_tenant_email_campaigns WHERE id = $1`, [
      campaignId,
    ]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapCampaignRow(result.rows[0] as Record<string, unknown>);
  },

  async findByIdempotencyKey(
    propertyId: string,
    idempotencyKey: string
  ): Promise<ITenantEmailCampaign | null> {
    const result = await pool.query(
      `SELECT * FROM property_tenant_email_campaigns
       WHERE property_id = $1 AND idempotency_key = $2`,
      [propertyId, idempotencyKey]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return mapCampaignRow(result.rows[0] as Record<string, unknown>);
  },

  async getListMetaByProperty(
    propertyId: string,
    filters: TTenantEmailCampaignsListFilters
  ): Promise<ITenantEmailCampaignsListMeta> {
    const { conditions, values } = buildCampaignListConditions(propertyId, filters);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total_count
       FROM property_tenant_email_campaigns
       WHERE ${conditions.join(" AND ")}`,
      values
    );
    const row = result.rows[0] as { total_count: number } | undefined;
    return {
      totalCount: row?.total_count ?? 0,
    };
  },

  async getSendRecipientRow(recipientId: string): Promise<ITenantEmailSendRecipientRow | null> {
    const result = await pool.query(
      `SELECT
        r.id AS recipient_id,
        r.campaign_id,
        r.email,
        r.status,
        c.property_id,
        c.subject,
        c.html_body,
        c.text_body,
        p.name AS property_name
      FROM property_tenant_email_recipients r
      JOIN property_tenant_email_campaigns c ON c.id = r.campaign_id
      JOIN properties p ON p.id = c.property_id
      WHERE r.id = $1`,
      [recipientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      campaignId: row.campaign_id as string,
      email: row.email as string,
      htmlBody: row.html_body as string,
      propertyId: row.property_id as string,
      propertyName: row.property_name as string,
      recipientId: row.recipient_id as string,
      status: row.status as TTenantEmailRecipientStatus,
      subject: row.subject as string,
      textBody: row.text_body as string,
    };
  },

  async incrementRecipientAttempt(recipientId: string, errorMessage: string): Promise<void> {
    await pool.query(
      `UPDATE property_tenant_email_recipients
       SET attempts = attempts + 1,
           last_error = $2
       WHERE id = $1 AND status = 'queued'`,
      [recipientId, errorMessage.slice(0, 2000)]
    );
  },

  async listCampaignIdsWithQueuedRecipients(): Promise<string[]> {
    const result = await pool.query(
      `SELECT DISTINCT campaign_id
       FROM property_tenant_email_recipients
       WHERE status = 'queued'
       ORDER BY campaign_id`
    );
    return result.rows.map((row) => (row as { campaign_id: string }).campaign_id);
  },

  async listPaginatedByProperty(
    propertyId: string,
    filters: TTenantEmailCampaignsListFilters,
    options: { cursor?: string; limit: number }
  ): Promise<{
    campaigns: ITenantEmailCampaignListItem[];
    meta?: ITenantEmailCampaignsListMeta;
    nextCursor: string | null;
  }> {
    const includeMeta = shouldIncludeListMeta(options.cursor);
    const listPromise = propertyTenantEmailCampaignsDb.listPaginatedPage(
      propertyId,
      filters,
      options
    );
    const metaPromise = includeMeta
      ? propertyTenantEmailCampaignsDb.getListMetaByProperty(propertyId, filters)
      : Promise.resolve(undefined);

    const [{ campaigns, nextCursor }, meta] = await Promise.all([listPromise, metaPromise]);

    return meta == null ? { campaigns, nextCursor } : { campaigns, meta, nextCursor };
  },

  async listPaginatedPage(
    propertyId: string,
    filters: TTenantEmailCampaignsListFilters,
    options: { cursor?: string; limit: number }
  ): Promise<{ campaigns: ITenantEmailCampaignListItem[]; nextCursor: string | null }> {
    const { conditions, values } = buildCampaignListConditions(propertyId, filters);
    let p = values.length + 1;

    if (options.cursor != null && options.cursor !== "") {
      const decoded = decodeKeysetCursor(options.cursor);
      conditions.push(`(created_at, id) < ($${p++}::timestamptz, $${p++}::uuid)`);
      values.push(decoded.createdAt, decoded.id);
    }

    const limitParam = p;
    values.push(options.limit + 1);

    const result = await pool.query(
      `${CAMPAIGN_LIST_SELECT}
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, options.limit, (last) =>
      encodeKeysetCursor(last.created_at as Date | string, last.id as string)
    );

    return {
      campaigns: pageRows.map((row) => mapCampaignListItemRow(row)),
      nextCursor,
    };
  },

  async listQueuedRecipientIds(campaignId: string): Promise<string[]> {
    const result = await pool.query(
      `SELECT id FROM property_tenant_email_recipients
       WHERE campaign_id = $1 AND status = 'queued'
       ORDER BY created_at ASC`,
      [campaignId]
    );
    return result.rows.map((row) => (row as { id: string }).id);
  },

  async listRecipients(campaignId: string): Promise<ITenantEmailCampaignRecipient[]> {
    const result = await pool.query(
      `SELECT * FROM property_tenant_email_recipients
       WHERE campaign_id = $1
       ORDER BY created_at ASC`,
      [campaignId]
    );
    return result.rows.map((row) => mapRecipientRow(row as Record<string, unknown>));
  },

  async markCampaignSendingIfQueued(campaignId: string): Promise<void> {
    await pool.query(
      `UPDATE property_tenant_email_campaigns
       SET status = 'sending'
       WHERE id = $1 AND status = 'queued'`,
      [campaignId]
    );
  },

  async markRecipientFailed(recipientId: string, errorMessage: string): Promise<void> {
    await pool.query(
      `UPDATE property_tenant_email_recipients
       SET status = 'failed',
           attempts = attempts + 1,
           last_error = $2
       WHERE id = $1 AND status = 'queued'`,
      [recipientId, errorMessage.slice(0, 2000)]
    );
  },

  async markRecipientSent(recipientId: string): Promise<void> {
    await pool.query(
      `UPDATE property_tenant_email_recipients
       SET status = 'sent',
           attempts = attempts + 1,
           sent_at = NOW(),
           last_error = NULL
       WHERE id = $1 AND status = 'queued'`,
      [recipientId]
    );
  },

  async markRecipientSkipped(recipientId: string, reason: string): Promise<void> {
    await pool.query(
      `UPDATE property_tenant_email_recipients
       SET status = 'skipped',
           last_error = $2
       WHERE id = $1 AND status = 'queued'`,
      [recipientId, reason.slice(0, 2000)]
    );
  },

  async refreshCampaignCompletion(campaignId: string): Promise<boolean> {
    const result = await pool.query<{
      previous_status: string;
      status: string;
    }>(
      `WITH previous AS (
         SELECT status FROM property_tenant_email_campaigns WHERE id = $1
       ),
       updated AS (
         UPDATE property_tenant_email_campaigns c
         SET
           sent_count = counts.sent_count,
           failed_count = counts.failed_count,
           skipped_count = counts.skipped_count,
           status = CASE
             WHEN counts.pending_count > 0 THEN c.status
             WHEN counts.failed_count > 0 THEN 'completed_with_errors'::property_tenant_email_campaign_status
             ELSE 'completed'::property_tenant_email_campaign_status
           END,
           completed_at = CASE
             WHEN counts.pending_count > 0 THEN c.completed_at
             ELSE COALESCE(c.completed_at, NOW())
           END
         FROM (
           SELECT
             COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
             COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
             COUNT(*) FILTER (WHERE status = 'skipped') AS skipped_count,
             COUNT(*) FILTER (WHERE status = 'queued') AS pending_count
           FROM property_tenant_email_recipients
           WHERE campaign_id = $1
         ) counts,
         previous
         WHERE c.id = $1
         RETURNING c.status, previous.status AS previous_status
       )
       SELECT status, previous_status FROM updated`,
      [campaignId]
    );

    const row = result.rows[0];
    if (row == null) {
      return false;
    }

    return didTenantEmailCampaignTransitionToTerminal(row.previous_status, row.status);
  },
};
