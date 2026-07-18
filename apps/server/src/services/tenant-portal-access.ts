import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";
import { tenantLeaseAccessDeniedError } from "@/errors/lease-errors";
import type { ILeaseTenantMembership } from "@/packages/shared";
import { TenantMembershipStatus } from "@/packages/shared";

export async function assertLeaseTenantAccess(
  leaseId: string,
  tenantUserId: string
): Promise<ILeaseTenantMembership> {
  const membership = await leaseTenantMembershipsDb.findActiveByLeaseAndTenantUser(
    leaseId,
    tenantUserId
  );
  if (!membership) {
    throw tenantLeaseAccessDeniedError();
  }
  return membership;
}

/** Read access for active or archived (ended) leases — no write APIs for either. */
export async function assertLeaseTenantReadAccess(
  leaseId: string,
  tenantUserId: string
): Promise<ILeaseTenantMembership> {
  const membership = await leaseTenantMembershipsDb.findByLeaseAndTenantUserWithStatuses(
    leaseId,
    tenantUserId,
    [TenantMembershipStatus.ACTIVE, TenantMembershipStatus.ENDED]
  );
  if (!membership) {
    throw tenantLeaseAccessDeniedError();
  }
  return membership;
}
