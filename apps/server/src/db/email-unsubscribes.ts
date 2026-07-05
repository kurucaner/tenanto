import { pool } from "./pool";

export const emailUnsubscribesDb = {
  async add(email: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    await pool.query(
      `INSERT INTO email_unsubscribes (email) VALUES ($1)
       ON CONFLICT (email) DO NOTHING`,
      [normalized]
    );
  },

  async isUnsubscribed(email: string): Promise<boolean> {
    const normalized = email.toLowerCase().trim();
    const result = await pool.query(
      "SELECT 1 FROM email_unsubscribes WHERE LOWER(TRIM(email)) = $1 LIMIT 1",
      [normalized]
    );
    return result.rows.length > 0;
  },
};
