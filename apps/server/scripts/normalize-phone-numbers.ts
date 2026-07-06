/**
 * One-time script to normalize existing property phone_number values to E.164.
 *
 * Usage:
 *   bun apps/server/scripts/normalize-phone-numbers.ts
 */
import { pool } from "../src/db/pool";
import { normalizeToE164 } from "@/packages/shared";

interface IPhoneRow {
  id: string;
  phone_number: string;
}

async function normalizePhoneNumbers(): Promise<void> {
  const client = await pool.connect();

  try {
    const { rows } = await client.query<IPhoneRow>(
      `SELECT id, phone_number
       FROM properties
       WHERE phone_number IS NOT NULL AND phone_number <> ''`
    );

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const normalized = normalizeToE164(row.phone_number);
      if (!normalized) {
        console.warn(`Skipping invalid phone for property ${row.id}: ${row.phone_number}`);
        skipped += 1;
        continue;
      }

      if (normalized === row.phone_number) {
        continue;
      }

      await client.query(`UPDATE properties SET phone_number = $1 WHERE id = $2`, [
        normalized,
        row.id,
      ]);
      console.log(`${row.id}: ${row.phone_number} -> ${normalized}`);
      updated += 1;
    }

    console.log(`Done. Updated ${updated}, skipped ${skipped}, unchanged ${rows.length - updated - skipped}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

normalizePhoneNumbers().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
