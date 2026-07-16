/**
 * One-time script to backfill rent_period_month on existing lease income lines.
 *
 * Usage:
 *   bun apps/server/scripts/backfill-income-line-rent-period-month.ts
 */
import { pool } from "../src/db/pool";

async function backfillIncomeLineRentPeriodMonth(): Promise<void> {
  const client = await pool.connect();

  try {
    const result = await client.query<{ updated_count: number }>(
      `WITH updated AS (
         UPDATE property_income_lines
         SET rent_period_month = left(transaction_date::text, 7)
         WHERE long_stay_id IS NOT NULL
           AND rent_period_month IS NULL
         RETURNING id
       )
       SELECT COUNT(*)::int AS updated_count FROM updated`
    );

    const updatedCount = result.rows[0]?.updated_count ?? 0;
    console.log(`Done. Updated ${updatedCount} income line(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

backfillIncomeLineRentPeriodMonth().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
