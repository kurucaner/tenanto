import { tenantUsersDb } from "@/db/tenant-users";
import {
  type ILeaseSecondaryTenantContact,
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  resolveSecondaryTenantContact,
} from "@/packages/shared";

import { loadSecondaryTenantContactsByLeaseIds } from "./load-secondary-tenant-contacts-by-lease-ids";

export async function resolveSecondaryTenantContactsForLongStay(
  longStay: IPropertyLongStay
): Promise<ILeaseSecondaryTenantContact[]> {
  const contactsByLeaseId = await loadSecondaryTenantContactsByLeaseIds([longStay.id]);
  return contactsByLeaseId.get(longStay.id) ?? [];
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
