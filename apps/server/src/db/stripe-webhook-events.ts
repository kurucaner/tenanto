import { pool } from "./pool";

export interface IStripeWebhookEvent {
  createdAt: string;
  payload: unknown;
  processedAt: string | null;
  stripeEventId: string;
  type: string;
}

function mapRow(row: Record<string, unknown>): IStripeWebhookEvent {
  return {
    createdAt: (row.created_at as Date).toISOString(),
    payload: row.payload,
    processedAt: row.processed_at ? (row.processed_at as Date).toISOString() : null,
    stripeEventId: row.stripe_event_id as string,
    type: row.type as string,
  };
}

export const stripeWebhookEventsDb = {
  async findById(stripeEventId: string): Promise<IStripeWebhookEvent | null> {
    const result = await pool.query(
      `SELECT * FROM stripe_webhook_events WHERE stripe_event_id = $1`,
      [stripeEventId]
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  },

  async markProcessed(stripeEventId: string): Promise<void> {
    await pool.query(
      `UPDATE stripe_webhook_events
       SET processed_at = CURRENT_TIMESTAMP
       WHERE stripe_event_id = $1`,
      [stripeEventId]
    );
  },

  /**
   * Insert event row if new. Returns the row when inserted; null when already present.
   */
  async tryInsert(input: {
    payload: unknown;
    stripeEventId: string;
    type: string;
  }): Promise<IStripeWebhookEvent | null> {
    const result = await pool.query(
      `INSERT INTO stripe_webhook_events (stripe_event_id, type, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING *`,
      [input.stripeEventId, input.type, JSON.stringify(input.payload)]
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  },
};
