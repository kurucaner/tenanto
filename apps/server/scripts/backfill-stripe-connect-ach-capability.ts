/**
 * Request `us_bank_account_ach_payments` on existing Connect accounts (Phase 1d).
 *
 * Usage:
 *   bun apps/server/scripts/backfill-stripe-connect-ach-capability.ts --dry-run
 *   bun apps/server/scripts/backfill-stripe-connect-ach-capability.ts
 *
 * Loads `apps/server/.env` before DB/Stripe modules (ESM import order). Requires
 * STRIPE_CONNECT_ENABLED=true and STRIPE_SECRET_KEY (test or live). Run in test mode
 * first; confirm capabilities in Stripe Dashboard → Connect → Accounts.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

function parseArgs(argv: readonly string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

async function backfillStripeConnectAchCapability(): Promise<void> {
  const { propertyStripeConnectService } = await import(
    "../src/services/property-stripe-connect-service"
  );
  const { pool } = await import("../src/db/pool");

  try {
    const { dryRun } = parseArgs(process.argv.slice(2));
    const result = await propertyStripeConnectService.backfillAchPaymentsCapability({ dryRun });

    console.log(
      JSON.stringify(
        {
          accounts: result.accounts,
          counts: result.counts,
          mode: dryRun ? "dry-run" : "execute",
        },
        null,
        2
      )
    );

    if (result.counts.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

backfillStripeConnectAchCapability().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
