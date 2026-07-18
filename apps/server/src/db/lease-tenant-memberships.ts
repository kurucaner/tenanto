import type { Pool, PoolClient } from "pg";

import { invalidTenantMembershipTransitionError } from "@/errors/lease-errors";
import { duplicatePortalInviteError } from "@/errors/portal-invite-errors";
import {
  canTransitionTenantMembershipStatus,
  type ILeaseTenantMembership,
  selectPrimaryMembershipForContact,
  TenantMembershipRole,
  TenantMembershipStatus,
  type TTenantMembershipRole,
  type TTenantMembershipStatus,
} from "@/packages/shared";
import {
  hashPortalInviteToken,
  portalInviteTokenMatchesHash,
} from "@/ses/tenant-portal-invite-token";

import { mapLeaseTenantMembershipRow } from "./mappers";
import { pool } from "./pool";

type DbQueryable = Pool | PoolClient;

export const PORTAL_INVITE_EXPIRY_DAYS = 30;

export interface CreateLeaseTenantMembershipInput {
  displayName: string;
  invitedBy: string;
  inviteEmail: string;
  inviteTokenHash: string;
  leaseId: string;
  role: TTenantMembershipRole;
  status: TTenantMembershipStatus;
  tenantUserId?: string | null;
}

export interface CreateListedSecondaryInput {
  contactPhone: string | null;
  displayName: string;
  invitedBy: string;
  inviteEmail: string | null;
  leaseId: string;
}

function statusTimestampColumn(status: TTenantMembershipStatus): string | null {
  switch (status) {
    case TenantMembershipStatus.ACTIVE:
      return "accepted_at";
    case TenantMembershipStatus.DECLINED:
      return "declined_at";
    case TenantMembershipStatus.REVOKED:
      return "revoked_at";
    case TenantMembershipStatus.ENDED:
      return "ended_at";
    default:
      return null;
  }
}

const LISTED_MEMBERSHIP_PLACEHOLDER_EXPIRES_AT = new Date("2099-12-31T23:59:59.000Z");

export const leaseTenantMembershipsDb = {
  async countNonTerminalSecondariesForLease(
    leaseId: string,
    db: DbQueryable = pool
  ): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM lease_tenant_memberships
       WHERE lease_id = $1
         AND role = $2::tenant_membership_role
         AND status NOT IN (
           $3::tenant_membership_status,
           $4::tenant_membership_status,
           $5::tenant_membership_status,
           $6::tenant_membership_status
         )`,
      [
        leaseId,
        TenantMembershipRole.SECONDARY,
        TenantMembershipStatus.DECLINED,
        TenantMembershipStatus.REVOKED,
        TenantMembershipStatus.ENDED,
        TenantMembershipStatus.EXPIRED,
      ]
    );
    return Number(result.rows[0]?.["count"] ?? 0);
  },

  async create(
    input: CreateLeaseTenantMembershipInput,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership> {
    const existing = await leaseTenantMembershipsDb.findNonTerminalByLeaseEmailRole(
      input.leaseId,
      input.inviteEmail,
      input.role,
      db
    );
    if (existing) {
      throw duplicatePortalInviteError(existing);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PORTAL_INVITE_EXPIRY_DAYS);

    const result = await db.query(
      `INSERT INTO lease_tenant_memberships (
         lease_id,
         tenant_user_id,
         role,
         invite_email,
         display_name,
         status,
         invited_by,
         invite_token_hash,
         invited_at,
         expires_at
       )
       VALUES ($1, $2, $3::tenant_membership_role, LOWER(TRIM($4)), $5, $6::tenant_membership_status, $7, $8, NOW(), $9)
       RETURNING *`,
      [
        input.leaseId,
        input.tenantUserId ?? null,
        input.role,
        input.inviteEmail,
        input.displayName,
        input.status,
        input.invitedBy,
        input.inviteTokenHash,
        expiresAt,
      ]
    );
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async createListedSecondary(
    input: CreateListedSecondaryInput,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership> {
    if (input.inviteEmail != null) {
      const existing = await leaseTenantMembershipsDb.findNonTerminalByLeaseEmailRole(
        input.leaseId,
        input.inviteEmail,
        TenantMembershipRole.SECONDARY,
        db
      );
      if (existing) {
        throw duplicatePortalInviteError(existing);
      }
    }

    const result = await db.query(
      `INSERT INTO lease_tenant_memberships (
         lease_id,
         tenant_user_id,
         role,
         invite_email,
         display_name,
         contact_phone,
         status,
         invited_by,
         invite_token_hash,
         invited_at,
         expires_at
       )
       VALUES (
         $1,
         NULL,
         $2::tenant_membership_role,
         CASE WHEN $3::text IS NULL THEN NULL ELSE LOWER(TRIM($3::text)) END,
         $4,
         $5,
         $6::tenant_membership_status,
         $7,
         NULL,
         NOW(),
         $8
       )
       RETURNING *`,
      [
        input.leaseId,
        TenantMembershipRole.SECONDARY,
        input.inviteEmail,
        input.displayName.trim(),
        input.contactPhone,
        TenantMembershipStatus.LISTED,
        input.invitedBy,
        LISTED_MEMBERSHIP_PLACEHOLDER_EXPIRES_AT,
      ]
    );
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async endAllNonTerminalForLease(
    leaseId: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership[]> {
    const result = await db.query(
      `UPDATE lease_tenant_memberships
       SET status = $1::tenant_membership_status,
           ended_at = NOW()
       WHERE lease_id = $2
         AND status IN (
           $3::tenant_membership_status,
           $4::tenant_membership_status,
           $5::tenant_membership_status,
           $6::tenant_membership_status
         )
       RETURNING *`,
      [
        TenantMembershipStatus.ENDED,
        leaseId,
        TenantMembershipStatus.ACTIVE,
        TenantMembershipStatus.PENDING_INVITE,
        TenantMembershipStatus.PENDING_ACCEPTANCE,
        TenantMembershipStatus.LISTED,
      ]
    );
    return result.rows.map((row) => mapLeaseTenantMembershipRow(row as Record<string, unknown>));
  },

  /**
   * If this membership is pending and past TTL, flip it to `expired` and return the updated row.
   * Returns null when no transition is needed.
   */
  async expireMembershipIfPastTtl(
    membership: ILeaseTenantMembership,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const isPending =
      membership.status === TenantMembershipStatus.PENDING_INVITE ||
      membership.status === TenantMembershipStatus.PENDING_ACCEPTANCE;
    if (!isPending || new Date(membership.expiresAt).getTime() > Date.now()) {
      return null;
    }
    return leaseTenantMembershipsDb.transitionStatus(
      membership.id,
      TenantMembershipStatus.EXPIRED,
      db
    );
  },

  /**
   * Persist TTL: pending invites past `expires_at` become `expired` in the DB.
   * Used by the production cron and lazy sweeps (portal-access / accept paths).
   */
  async expirePendingPortalInvites(db: DbQueryable = pool): Promise<number> {
    const result = await db.query(
      `UPDATE lease_tenant_memberships
       SET status = $1::tenant_membership_status
       WHERE status IN (
           $2::tenant_membership_status,
           $3::tenant_membership_status
         )
         AND expires_at <= NOW()`,
      [
        TenantMembershipStatus.EXPIRED,
        TenantMembershipStatus.PENDING_INVITE,
        TenantMembershipStatus.PENDING_ACCEPTANCE,
      ]
    );
    return result.rowCount ?? 0;
  },

  async findActiveByLeaseAndTenantUser(
    leaseId: string,
    tenantUserId: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE lease_id = $1
         AND tenant_user_id = $2
         AND status = $3::tenant_membership_status`,
      [leaseId, tenantUserId, TenantMembershipStatus.ACTIVE]
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async findActiveByTenantUserId(
    tenantUserId: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership[]> {
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE tenant_user_id = $1
         AND status = $2::tenant_membership_status
       ORDER BY accepted_at DESC NULLS LAST, created_at DESC`,
      [tenantUserId, TenantMembershipStatus.ACTIVE]
    );
    return result.rows.map((row) => mapLeaseTenantMembershipRow(row as Record<string, unknown>));
  },

  async findById(id: string, db: DbQueryable = pool): Promise<ILeaseTenantMembership | null> {
    const result = await db.query(`SELECT * FROM lease_tenant_memberships WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  /**
   * Resolve membership by raw invite token (hash lookup + constant-time digest verify).
   * Returns null when the hash was cleared (accepted / single-use) or does not match.
   */
  async findByInviteToken(
    rawToken: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const inviteTokenHash = hashPortalInviteToken(rawToken);
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE invite_token_hash = $1
         AND invite_token_hash IS NOT NULL`,
      [inviteTokenHash]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const storedHash = row["invite_token_hash"];
    if (typeof storedHash !== "string" || !portalInviteTokenMatchesHash(rawToken, storedHash)) {
      return null;
    }

    return mapLeaseTenantMembershipRow(row);
  },

  async findByLeaseAndTenantUserWithStatuses(
    leaseId: string,
    tenantUserId: string,
    statuses: readonly TTenantMembershipStatus[],
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE lease_id = $1
         AND tenant_user_id = $2
         AND status = ANY($3::tenant_membership_status[])
       ORDER BY ended_at DESC NULLS LAST, accepted_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [leaseId, tenantUserId, statuses]
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async findByLeaseId(leaseId: string, db: DbQueryable = pool): Promise<ILeaseTenantMembership[]> {
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE lease_id = $1
       ORDER BY invited_at DESC, created_at DESC`,
      [leaseId]
    );
    return result.rows.map((row) => mapLeaseTenantMembershipRow(row as Record<string, unknown>));
  },

  async findByTokenHash(
    inviteTokenHash: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE invite_token_hash = $1
         AND invite_token_hash IS NOT NULL`,
      [inviteTokenHash]
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async findEndedByTenantUserId(
    tenantUserId: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership[]> {
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE tenant_user_id = $1
         AND status = $2::tenant_membership_status
       ORDER BY ended_at DESC NULLS LAST, accepted_at DESC NULLS LAST, created_at DESC`,
      [tenantUserId, TenantMembershipStatus.ENDED]
    );
    return result.rows.map((row) => mapLeaseTenantMembershipRow(row as Record<string, unknown>));
  },

  async findNonTerminalByLeaseEmailRole(
    leaseId: string,
    inviteEmail: string,
    role: TTenantMembershipRole,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE lease_id = $1
         AND LOWER(TRIM(invite_email)) = LOWER(TRIM($2))
         AND role = $3::tenant_membership_role
         AND status NOT IN ('declined', 'revoked', 'ended', 'expired')
       ORDER BY created_at DESC
       LIMIT 1`,
      [leaseId, inviteEmail, role]
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async findPendingAcceptanceByTenantUserId(
    tenantUserId: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership[]> {
    const result = await db.query(
      `SELECT * FROM lease_tenant_memberships
       WHERE tenant_user_id = $1
         AND status = $2::tenant_membership_status
         AND expires_at > NOW()
       ORDER BY invited_at DESC, created_at DESC`,
      [tenantUserId, TenantMembershipStatus.PENDING_ACCEPTANCE]
    );
    return result.rows.map((row) => mapLeaseTenantMembershipRow(row as Record<string, unknown>));
  },

  async linkTenantUser(
    id: string,
    tenantUserId: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const result = await db.query(
      `UPDATE lease_tenant_memberships
       SET tenant_user_id = $1
       WHERE id = $2
         AND tenant_user_id IS NULL
       RETURNING *`,
      [tenantUserId, id]
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async transitionStatus(
    id: string,
    toStatus: TTenantMembershipStatus,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const current = await leaseTenantMembershipsDb.findById(id, db);
    if (!current) return null;

    if (!canTransitionTenantMembershipStatus(current.status, toStatus)) {
      throw invalidTenantMembershipTransitionError(current.status, toStatus);
    }

    const timestampColumn = statusTimestampColumn(toStatus);
    const setTimestamp = timestampColumn != null ? `, ${timestampColumn} = NOW()` : "";
    // Single-use forever: accepted invite links can never be redeemed again.
    const clearInviteToken =
      toStatus === TenantMembershipStatus.ACTIVE ? ", invite_token_hash = NULL" : "";

    const result = await db.query(
      `UPDATE lease_tenant_memberships
       SET status = $1::tenant_membership_status${setTimestamp}${clearInviteToken}
       WHERE id = $2
       RETURNING *`,
      [toStatus, id]
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async updateInviteToken(
    id: string,
    inviteTokenHash: string,
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PORTAL_INVITE_EXPIRY_DAYS);

    const result = await db.query(
      `UPDATE lease_tenant_memberships
       SET invite_token_hash = $1,
           expires_at = $2,
           invited_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [inviteTokenHash, expiresAt, id]
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async updatePendingPrimaryContact(
    membershipId: string,
    patch: { displayName?: string; inviteEmail?: string },
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [membershipId];
    let paramIndex = 2;

    if (patch.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      values.push(patch.displayName.trim());
    }
    if (patch.inviteEmail !== undefined) {
      setClauses.push(`invite_email = LOWER(TRIM($${paramIndex++}))`);
      values.push(patch.inviteEmail);
    }

    if (setClauses.length === 0) {
      return leaseTenantMembershipsDb.findById(membershipId, db);
    }

    const result = await db.query(
      `UPDATE lease_tenant_memberships
       SET ${setClauses.join(", ")},
           updated_at = NOW()
       WHERE id = $1
         AND role = 'primary'::tenant_membership_role
         AND status IN ('pending_invite'::tenant_membership_status, 'pending_acceptance'::tenant_membership_status)
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },

  async updateSecondaryContact(
    membershipId: string,
    patch: { contactPhone?: string | null; displayName?: string; inviteEmail?: string | null },
    db: DbQueryable = pool
  ): Promise<ILeaseTenantMembership | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [membershipId];
    let paramIndex = 2;

    if (patch.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      values.push(patch.displayName.trim());
    }
    if (patch.inviteEmail !== undefined) {
      if (patch.inviteEmail === null) {
        setClauses.push("invite_email = NULL");
      } else {
        setClauses.push(`invite_email = LOWER(TRIM($${paramIndex++}))`);
        values.push(patch.inviteEmail);
      }
    }
    if (patch.contactPhone !== undefined) {
      setClauses.push(`contact_phone = $${paramIndex++}`);
      values.push(patch.contactPhone);
    }

    if (setClauses.length === 0) {
      return leaseTenantMembershipsDb.findById(membershipId, db);
    }

    const result = await db.query(
      `UPDATE lease_tenant_memberships
       SET ${setClauses.join(", ")},
           updated_at = NOW()
       WHERE id = $1
         AND role = 'secondary'::tenant_membership_role
         AND status IN (
           'listed'::tenant_membership_status,
           'pending_invite'::tenant_membership_status,
           'pending_acceptance'::tenant_membership_status
         )
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
  },
};

/** Primary membership row for effective tenant contact resolution (Phase 1+). */
export async function loadPrimaryMembershipForLease(
  leaseId: string,
  db: DbQueryable = pool
): Promise<ILeaseTenantMembership | null> {
  const memberships = await leaseTenantMembershipsDb.findByLeaseId(leaseId, db);
  return selectPrimaryMembershipForContact(memberships);
}

/** Non-terminal secondary membership rows for many leases (includes `listed`). */
export async function loadSecondaryMembershipsByLeaseIds(
  leaseIds: readonly string[],
  db: DbQueryable = pool
): Promise<Map<string, ILeaseTenantMembership[]>> {
  if (leaseIds.length === 0) {
    return new Map();
  }

  const result = await db.query(
    `SELECT * FROM lease_tenant_memberships
     WHERE lease_id = ANY($1::uuid[])
       AND role = $2::tenant_membership_role
       AND status NOT IN (
         $3::tenant_membership_status,
         $4::tenant_membership_status,
         $5::tenant_membership_status,
         $6::tenant_membership_status
       )
     ORDER BY lease_id ASC, created_at ASC, invited_at ASC`,
    [
      leaseIds,
      TenantMembershipRole.SECONDARY,
      TenantMembershipStatus.DECLINED,
      TenantMembershipStatus.REVOKED,
      TenantMembershipStatus.ENDED,
      TenantMembershipStatus.EXPIRED,
    ]
  );

  const membershipsByLeaseId = new Map<string, ILeaseTenantMembership[]>();
  for (const row of result.rows) {
    const membership = mapLeaseTenantMembershipRow(row as Record<string, unknown>);
    const existing = membershipsByLeaseId.get(membership.leaseId);
    if (existing) {
      existing.push(membership);
    } else {
      membershipsByLeaseId.set(membership.leaseId, [membership]);
    }
  }

  return membershipsByLeaseId;
}

/** Non-terminal secondary membership rows for a lease (includes `listed`). */
export async function loadSecondaryMembershipsForLease(
  leaseId: string,
  db: DbQueryable = pool
): Promise<ILeaseTenantMembership[]> {
  const membershipsByLeaseId = await loadSecondaryMembershipsByLeaseIds([leaseId], db);
  return membershipsByLeaseId.get(leaseId) ?? [];
}

/** Batch-load display names for non-terminal secondary occupants keyed by lease id. */
export async function loadSecondaryOccupancyNamesByLeaseIds(
  leaseIds: readonly string[],
  db: DbQueryable = pool
): Promise<Map<string, string[]>> {
  if (leaseIds.length === 0) {
    return new Map();
  }

  const result = await db.query(
    `SELECT ltm.lease_id,
            CASE
              WHEN ltm.status = $7::tenant_membership_status
                AND ltm.tenant_user_id IS NOT NULL
                AND NULLIF(TRIM(tu.name), '') IS NOT NULL
              THEN TRIM(tu.name)
              ELSE NULLIF(TRIM(ltm.display_name), '')
            END AS occupant_name
     FROM lease_tenant_memberships ltm
     LEFT JOIN tenant_users tu ON tu.id = ltm.tenant_user_id
     WHERE ltm.lease_id = ANY($1::uuid[])
       AND ltm.role = $2::tenant_membership_role
       AND ltm.status NOT IN (
         $3::tenant_membership_status,
         $4::tenant_membership_status,
         $5::tenant_membership_status,
         $6::tenant_membership_status
       )
     ORDER BY ltm.lease_id ASC, ltm.created_at ASC`,
    [
      leaseIds,
      TenantMembershipRole.SECONDARY,
      TenantMembershipStatus.DECLINED,
      TenantMembershipStatus.REVOKED,
      TenantMembershipStatus.ENDED,
      TenantMembershipStatus.EXPIRED,
      TenantMembershipStatus.ACTIVE,
    ]
  );

  const namesByLeaseId = new Map<string, string[]>();
  for (const row of result.rows as Array<{ lease_id: string; occupant_name: string | null }>) {
    const name = row.occupant_name?.trim();
    if (!name) {
      continue;
    }
    const existing = namesByLeaseId.get(row.lease_id);
    if (existing) {
      existing.push(name);
    } else {
      namesByLeaseId.set(row.lease_id, [name]);
    }
  }

  return namesByLeaseId;
}
