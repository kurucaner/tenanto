import type { PoolClient } from "pg";

import {
  leaseTenantMembershipsDb,
  loadSecondaryMembershipsForLease,
} from "@/db/lease-tenant-memberships";
import { parseSecondaryTenants } from "@/db/mappers";
import { pool } from "@/db/pool";
import { tenantUsersDb } from "@/db/tenant-users";
import { isDuplicatePortalInviteError } from "@/errors/portal-invite-errors";
import {
  type ISecondaryBackfillPlannedAction,
  type ISecondaryBackfillVerificationGap,
  type ISecondaryBackfillVerificationResult,
  isValidE164,
  normalizeToE164,
  planSecondaryTenantBackfillForLease,
  summarizeSecondaryBackfillVerification,
  verifySecondaryTenantBackfillForLease,
} from "@/packages/shared";

export interface ISecondaryTenantMembershipBackfillOptions {
  dryRun: boolean;
  syncPhones: boolean;
  verifyOnly: boolean;
}

export interface ISecondaryTenantMembershipBackfillCounts {
  driftLogs: number;
  inserted: number;
  invalidJsonb: number;
  phonesSynced: number;
  skipped: number;
  updated: number;
}

export interface ISecondaryTenantMembershipBackfillResult {
  counts: ISecondaryTenantMembershipBackfillCounts;
  jsonbColumnPresent: boolean;
  verification: ISecondaryBackfillVerificationResult;
}

interface ILeaseBackfillRow {
  created_by: string;
  id: string;
  property_id: string;
  secondary_tenants: unknown;
}

function normalizeNullablePhone(phone: string | null): string | null {
  if (!phone?.trim()) {
    return null;
  }
  return normalizeToE164(phone.trim()) ?? null;
}

async function hasSecondaryTenantsJsonbColumn(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'property_long_stays'
         AND column_name = 'secondary_tenants'
     ) AS exists`
  );
  return result.rows[0]?.exists === true;
}

async function loadActiveLeasesForBackfill(
  client: PoolClient,
  jsonbColumnPresent: boolean
): Promise<ILeaseBackfillRow[]> {
  if (jsonbColumnPresent) {
    const result = await client.query<ILeaseBackfillRow>(
      `SELECT pls.id,
              pls.property_id,
              pls.secondary_tenants,
              p.created_by
       FROM property_long_stays pls
       JOIN properties p ON p.id = pls.property_id
       WHERE pls.status = 'active'
       ORDER BY pls.created_at ASC, pls.id ASC`
    );
    return result.rows;
  }

  const result = await client.query<ILeaseBackfillRow>(
    `SELECT pls.id,
            pls.property_id,
            '[]'::jsonb AS secondary_tenants,
            p.created_by
     FROM property_long_stays pls
     JOIN properties p ON p.id = pls.property_id
     WHERE pls.status = 'active'
     ORDER BY pls.created_at ASC, pls.id ASC`
  );
  return result.rows;
}

async function applyPlannedAction(
  action: ISecondaryBackfillPlannedAction,
  invitedBy: string,
  leaseId: string,
  dryRun: boolean
): Promise<keyof ISecondaryTenantMembershipBackfillCounts | null> {
  switch (action.kind) {
    case "insert_listed": {
      if (dryRun) {
        return "inserted";
      }
      try {
        await leaseTenantMembershipsDb.createListedSecondary({
          contactPhone: normalizeNullablePhone(action.contactPhone),
          displayName: action.displayName,
          invitedBy,
          inviteEmail: action.email,
          leaseId,
        });
        return "inserted";
      } catch (error) {
        if (isDuplicatePortalInviteError(error)) {
          return "skipped";
        }
        throw error;
      }
    }
    case "update_contact": {
      if (!action.membershipId) {
        return null;
      }
      if (dryRun) {
        return "updated";
      }
      const updated = await leaseTenantMembershipsDb.updateSecondaryContact(action.membershipId, {
        contactPhone: normalizeNullablePhone(action.contactPhone),
        displayName: action.displayName,
      });
      return updated ? "updated" : "skipped";
    }
    case "log_email_drift":
    case "log_orphan_membership":
      return "driftLogs";
    case "skip_active_linked":
    case "skip_duplicate_jsonb":
    case "skip_noop":
      return "skipped";
    case "skip_invalid_jsonb":
      return "invalidJsonb";
    default:
      return null;
  }
}

async function verifyLeases(
  leases: readonly ILeaseBackfillRow[]
): Promise<ISecondaryBackfillVerificationGap[]> {
  const gaps: ISecondaryBackfillVerificationGap[] = [];

  for (const lease of leases) {
    const jsonbTenants = parseSecondaryTenants(lease.secondary_tenants);
    const memberships = await loadSecondaryMembershipsForLease(lease.id);
    const gap = verifySecondaryTenantBackfillForLease({
      jsonbTenants,
      leaseId: lease.id,
      memberships,
    });
    if (gap) {
      gaps.push(gap);
    }
  }

  return gaps;
}

async function syncLinkedSecondaryPhones(dryRun: boolean): Promise<number> {
  const result = await pool.query<{
    contact_phone: string | null;
    tenant_user_id: string;
  }>(
    `SELECT ltm.tenant_user_id,
            ltm.contact_phone
     FROM lease_tenant_memberships ltm
     JOIN tenant_users tu ON tu.id = ltm.tenant_user_id
     WHERE ltm.role = 'secondary'::tenant_membership_role
       AND ltm.status = 'active'::tenant_membership_status
       AND ltm.tenant_user_id IS NOT NULL
       AND tu.phone IS NULL
       AND ltm.contact_phone IS NOT NULL
       AND TRIM(ltm.contact_phone) <> ''`
  );

  let phonesSynced = 0;
  for (const row of result.rows) {
    const phone = normalizeNullablePhone(row.contact_phone);
    if (!phone || !isValidE164(phone)) {
      continue;
    }
    if (dryRun) {
      phonesSynced += 1;
      continue;
    }
    const updated = await tenantUsersDb.setUnverifiedPhoneIfNull(row.tenant_user_id, phone);
    if (updated) {
      phonesSynced += 1;
    }
  }

  return phonesSynced;
}

export async function runSecondaryTenantMembershipBackfill(
  options: ISecondaryTenantMembershipBackfillOptions
): Promise<ISecondaryTenantMembershipBackfillResult> {
  const client = await pool.connect();
  const counts: ISecondaryTenantMembershipBackfillCounts = {
    driftLogs: 0,
    inserted: 0,
    invalidJsonb: 0,
    phonesSynced: 0,
    skipped: 0,
    updated: 0,
  };

  try {
    const jsonbColumnPresent = await hasSecondaryTenantsJsonbColumn(client);
    const leases = await loadActiveLeasesForBackfill(client, jsonbColumnPresent);

    if (!options.verifyOnly && jsonbColumnPresent) {
      for (const lease of leases) {
        const jsonbTenants = parseSecondaryTenants(lease.secondary_tenants);
        if (jsonbTenants.length === 0) {
          continue;
        }

        const memberships = await loadSecondaryMembershipsForLease(lease.id, client);
        const plan = planSecondaryTenantBackfillForLease({
          jsonbTenants,
          leaseId: lease.id,
          memberships,
        });

        for (const action of plan.actions) {
          const bucket = await applyPlannedAction(
            action,
            lease.created_by,
            lease.id,
            options.dryRun
          );
          if (bucket) {
            if (bucket === "invalidJsonb" && action.kind === "skip_invalid_jsonb") {
              const match = action.message?.match(/Skipped (\d+)/);
              counts.invalidJsonb += match ? Number(match[1]) : 1;
            } else {
              counts[bucket] += 1;
            }
          }
          if (
            action.message &&
            (action.kind === "log_email_drift" ||
              action.kind === "insert_listed" ||
              action.kind === "skip_duplicate_jsonb" ||
              action.kind === "skip_invalid_jsonb")
          ) {
            console.log(`[lease ${lease.id}] ${action.kind}: ${action.message}`);
          }
        }
      }
    } else if (!options.verifyOnly && !jsonbColumnPresent) {
      console.warn(
        "property_long_stays.secondary_tenants column is absent; skipped JSONB→membership backfill."
      );
    }

    const gaps = await verifyLeases(leases);
    const verification = summarizeSecondaryBackfillVerification(gaps);

    if (options.syncPhones) {
      counts.phonesSynced = await syncLinkedSecondaryPhones(options.dryRun);
    }

    return {
      counts,
      jsonbColumnPresent,
      verification,
    };
  } finally {
    client.release();
  }
}
