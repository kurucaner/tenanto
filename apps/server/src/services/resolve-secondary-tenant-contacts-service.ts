import { loadSecondaryMembershipsByLeaseIds } from "@/db/lease-tenant-memberships";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  type ILeaseSecondaryTenantContact,
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  resolveSecondaryTenantContact,
  resolveSecondaryTenantContactsForLease,
} from "@/packages/shared";

import {
  loadSecondaryTenantContactsByLeaseIds,
  loadTenantUsersByIdForMemberships,
} from "./load-secondary-tenant-contacts-by-lease-ids";

export async function resolveSecondaryTenantContactsForLongStay(
  longStay: IPropertyLongStay
): Promise<ILeaseSecondaryTenantContact[]> {
  if (longStay.secondaryTenants.length === 0) {
    const contactsByLeaseId = await loadSecondaryTenantContactsByLeaseIds([longStay.id]);
    return contactsByLeaseId.get(longStay.id) ?? [];
  }

  const membershipsByLeaseId = await loadSecondaryMembershipsByLeaseIds([longStay.id]);
  const memberships = membershipsByLeaseId.get(longStay.id) ?? [];
  const tenantUsersById = await loadTenantUsersByIdForMemberships(memberships);

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
