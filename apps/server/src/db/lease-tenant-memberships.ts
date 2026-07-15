import type { Pool, PoolClient } from "pg";

import {
  canTransitionTenantMembershipStatus,
  type ILeaseTenantMembership,
  TenantMembershipStatus,
  type TTenantMembershipStatus,
} from "@/packages/shared";

import { mapLeaseTenantMembershipRow } from "./mappers";
import { pool } from "./pool";

type DbQueryable = Pool | PoolClient;

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

  async findById(id: string, db: DbQueryable = pool): Promise<ILeaseTenantMembership | null> {
    const result = await db.query(`SELECT * FROM lease_tenant_memberships WHERE id = $1`, [id]);
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
};
