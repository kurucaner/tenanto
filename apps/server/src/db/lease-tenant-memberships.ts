import type { Pool, PoolClient } from "pg";

import {
  canTransitionTenantMembershipStatus,
  type ILeaseTenantMembership,
  TenantMembershipStatus,
  type TTenantMembershipRole,
  type TTenantMembershipStatus,
} from "@/packages/shared";

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

export class DuplicatePortalInviteError extends Error {
  constructor(public readonly membership: ILeaseTenantMembership) {
    super("A pending portal invite already exists for this lease occupant");
    this.name = "DuplicatePortalInviteError";
  }
}

export class InvalidTenantMembershipTransitionError extends Error {
  constructor(
    public readonly from: TTenantMembershipStatus,
    public readonly to: TTenantMembershipStatus
  ) {
    super(`Invalid tenant membership transition: ${from} → ${to}`);
    this.name = "InvalidTenantMembershipTransitionError";
  }
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

export const leaseTenantMembershipsDb = {
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
      throw new DuplicatePortalInviteError(existing);
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
           $5::tenant_membership_status
         )
       RETURNING *`,
      [
        TenantMembershipStatus.ENDED,
        leaseId,
        TenantMembershipStatus.ACTIVE,
        TenantMembershipStatus.PENDING_INVITE,
        TenantMembershipStatus.PENDING_ACCEPTANCE,
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
      `SELECT * FROM lease_tenant_memberships WHERE invite_token_hash = $1`,
      [inviteTokenHash]
    );
    if (result.rows.length === 0) return null;
    return mapLeaseTenantMembershipRow(result.rows[0] as Record<string, unknown>);
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
      throw new InvalidTenantMembershipTransitionError(current.status, toStatus);
    }

    const timestampColumn = statusTimestampColumn(toStatus);
    const setTimestamp = timestampColumn != null ? `, ${timestampColumn} = NOW()` : "";

    const result = await db.query(
      `UPDATE lease_tenant_memberships
       SET status = $1::tenant_membership_status${setTimestamp}
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
};
