import { AccountEvent } from "../server-types";
import { pool } from "./pool";

interface LogEventParams {
  eventType: AccountEvent;
  metadata?: Record<string, unknown>;
  userId: string;
}

export const accountEventsDb = {
  async logEvent({ eventType, metadata, userId }: LogEventParams): Promise<void> {
    await pool.query(
      `INSERT INTO user_account_events (user_id, event_type, metadata)
       VALUES ($1, $2, $3)`,
      [userId, eventType, metadata ? JSON.stringify(metadata) : null]
    );
  },
};
