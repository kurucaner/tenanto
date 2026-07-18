import { loadSecondaryMembershipsForLease } from "@/db/lease-tenant-memberships";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  type ILeaseSecondaryTenantContact,
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  type ITenantUser,
  resolveSecondaryTenantContact,
  resolveSecondaryTenantContactsForLease,
} from "@/packages/shared";

export async function resolveSecondaryTenantContactsForLongStay(
  longStay: IPropertyLongStay
): Promise<ILeaseSecondaryTenantContact[]> {
  const memberships = await loadSecondaryMembershipsForLease(longStay.id);
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

  return resolveSecondaryTenantContactsForLease({
    jsonbOrphans: longStay.secondaryTenants,
    memberships,
    tenantUsersById,
  });
}

export async function buildSecondaryOccupantMutationResponse(
  membership: ILeaseTenantMembership
): Promise<{ contact: ILeaseSecondaryTenantContact; membership: ILeaseTenantMembership }> {
  const tenantUser =
    membership.tenantUserId != null ? await tenantUsersDb.findById(membership.tenantUserId) : null;
  const contact = resolveSecondaryTenantContact(membership, tenantUser);
  if (!contact) {
    throw new Error("Secondary occupant contact could not be resolved");
  }
  return { contact, membership };
}
