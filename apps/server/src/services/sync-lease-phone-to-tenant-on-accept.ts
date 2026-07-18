import { propertyLongStaysDb } from "@/db/property-long-stays";
import { tenantUsersDb } from "@/db/tenant-users";
import type { ILeaseTenantMembership, IPropertyLongStay, ITenantUser } from "@/packages/shared";
import { isValidE164, TenantMembershipRole } from "@/packages/shared";

async function copyUnverifiedPhoneIfNull(
  tenantUser: ITenantUser,
  phone: string | null | undefined
): Promise<ITenantUser> {
  if (tenantUser.phone != null) {
    return tenantUser;
  }

  const trimmedPhone = phone?.trim() ?? "";
  if (!trimmedPhone || !isValidE164(trimmedPhone)) {
    return tenantUser;
  }

  const updated = await tenantUsersDb.setUnverifiedPhoneIfNull(tenantUser.id, trimmedPhone);
  return updated ?? tenantUser;
}

/**
 * On invite accept, copy operator-entered contact phone to tenant_users.phone when the
 * account has no phone yet. Primary: lease.tenant_phone. Secondary: membership.contact_phone.
 * Does not set phone_verified_at.
 */
export async function syncLeasePhoneToTenantUserOnAccept(
  membership: ILeaseTenantMembership,
  tenantUser: ITenantUser,
  lease?: IPropertyLongStay | null
): Promise<ITenantUser> {
  if (membership.role === TenantMembershipRole.SECONDARY) {
    return copyUnverifiedPhoneIfNull(tenantUser, membership.contactPhone);
  }

  if (membership.role !== TenantMembershipRole.PRIMARY) {
    return tenantUser;
  }

  const resolvedLease = lease ?? (await propertyLongStaysDb.findById(membership.leaseId));
  return copyUnverifiedPhoneIfNull(tenantUser, resolvedLease?.tenantPhone);
}
