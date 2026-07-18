/**
 * Idempotent JSONB → secondary membership backfill (S1b).
 *
 * Usage:
 *   bun apps/server/scripts/backfill-secondary-tenant-memberships.ts
 *   bun apps/server/scripts/backfill-secondary-tenant-memberships.ts --dry-run
 *   bun apps/server/scripts/backfill-secondary-tenant-memberships.ts --verify-only
 *   bun apps/server/scripts/backfill-secondary-tenant-memberships.ts --sync-phones
 */
import { pool } from "../src/db/pool";
import { runSecondaryTenantMembershipBackfill } from "../src/services/secondary-tenant-membership-backfill-service";

function parseArgs(argv: readonly string[]): {
  dryRun: boolean;
  syncPhones: boolean;
  verifyOnly: boolean;
} {
  const dryRun = argv.includes("--dry-run");
  const verifyOnly = argv.includes("--verify-only");
  const syncPhones = argv.includes("--sync-phones");
  return {
    dryRun: verifyOnly ? true : dryRun,
    syncPhones,
    verifyOnly,
  };
}

async function backfillSecondaryTenantMemberships(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const result = await runSecondaryTenantMembershipBackfill(options);

  console.log(
    JSON.stringify(
      {
        counts: result.counts,
        jsonbColumnPresent: result.jsonbColumnPresent,
        mode: options.verifyOnly ? "verify-only" : options.dryRun ? "dry-run" : "execute",
        verification: {
          gapCount: result.verification.gapCount,
          ok: result.verification.ok,
        },
      },
      null,
      2
    )
  );

  if (result.verification.gapCount > 0) {
    console.log("\nVerification gaps:");
    for (const gap of result.verification.gaps) {
      console.log(
        `- lease ${gap.leaseId}: ${gap.message} (jsonb=${gap.jsonbEmails.join(", ") || "none"}; memberships=${gap.membershipEmails.join(", ") || "none"})`
      );
    }
  }

  if (!result.verification.ok) {
    process.exitCode = 1;
  }
}

backfillSecondaryTenantMemberships()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
