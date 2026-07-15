import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";
import type { ILeaseTenantMembership } from "@/packages/shared";

export class TenantLeaseAccessDeniedError extends Error {
  constructor(message = "Access denied") {
    super(message);
    this.name = "TenantLeaseAccessDeniedError";
  }
}

export async function assertLeaseTenantAccess(
  leaseId: string,
  tenantUserId: string
): Promise<ILeaseTenantMembership> {
  const membership = await leaseTenantMembershipsDb.findActiveByLeaseAndTenantUser(
    leaseId,
    tenantUserId
  );
  if (!membership) {
    throw new TenantLeaseAccessDeniedError();
  }
  return membership;
}
