import { loadSecondaryMembershipsByLeaseIds } from "@/db/lease-tenant-memberships";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  type ILeaseSecondaryTenantContact,
  type ILeaseTenantMembership,
  type ITenantUser,
  resolveSecondaryTenantContactsForLease,
} from "@/packages/shared";

export async function loadTenantUsersByIdForMemberships(
  memberships: readonly ILeaseTenantMembership[]
): Promise<Record<string, ITenantUser>> {
  const tenantUserIds = [
    ...new Set(
      memberships
        .map((membership) => membership.tenantUserId)
        .filter((tenantUserId): tenantUserId is string => tenantUserId != null)
    ),
  ];
  const tenantUsers = await Promise.all(
    tenantUserIds.map((tenantUserId) => tenantUsersDb.findById(tenantUserId))
  );
  const tenantUsersById: Record<string, ITenantUser> = {};
  for (const tenantUser of tenantUsers) {
    if (tenantUser) {
      tenantUsersById[tenantUser.id] = tenantUser;
    }
  }
  return tenantUsersById;
}

export async function loadSecondaryTenantContactsByLeaseIds(
  leaseIds: readonly string[]
): Promise<Map<string, ILeaseSecondaryTenantContact[]>> {
  if (leaseIds.length === 0) {
    return new Map();
  }

  const uniqueLeaseIds = [...new Set(leaseIds)];
  const membershipsByLeaseId = await loadSecondaryMembershipsByLeaseIds(uniqueLeaseIds);
  const allMemberships = [...membershipsByLeaseId.values()].flat();
  const tenantUsersById = await loadTenantUsersByIdForMemberships(allMemberships);

  const contactsByLeaseId = new Map<string, ILeaseSecondaryTenantContact[]>();
  for (const [leaseId, memberships] of membershipsByLeaseId) {
    contactsByLeaseId.set(
      leaseId,
      resolveSecondaryTenantContactsForLease({
        memberships,
        tenantUsersById,
      })
    );
  }

  return contactsByLeaseId;
}
