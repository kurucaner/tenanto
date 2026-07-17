import { propertyLongStaysDb } from "@/db/property-long-stays";
import { tenantUsersDb } from "@/db/tenant-users";
import type { ILeaseTenantMembership, IPropertyLongStay, ITenantUser } from "@/packages/shared";
import { isValidE164, TenantMembershipRole } from "@/packages/shared";

/**
 * On primary invite accept, copy lease.tenant_phone to tenant_users.phone when the
 * account has no phone yet. Does not set phone_verified_at (operator-entered contact).
 */
export async function syncLeasePhoneToTenantUserOnAccept(
  membership: ILeaseTenantMembership,
  tenantUser: ITenantUser,
  lease?: IPropertyLongStay | null
): Promise<ITenantUser> {
  if (membership.role !== TenantMembershipRole.PRIMARY) {
    return tenantUser;
  }

  if (tenantUser.phone != null) {
    return tenantUser;
  }

  const resolvedLease = lease ?? (await propertyLongStaysDb.findById(membership.leaseId));
  const leasePhone = resolvedLease?.tenantPhone?.trim();
  if (!leasePhone || !isValidE164(leasePhone)) {
    return tenantUser;
  }

  const updated = await tenantUsersDb.setUnverifiedPhoneIfNull(tenantUser.id, leasePhone);
  return updated ?? tenantUser;
}
