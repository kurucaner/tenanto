import {
  type ILeaseSecondaryTenantContact,
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  mapLegacyJsonbSecondaryTenantToContact,
  TenantMembershipRole,
} from "@/packages/shared";

import { findLeasePortalMembership } from "./lease-portal-access-display";

/**
 * Prefer API-resolved contacts; fall back to legacy JSONB on the lease when the field
 * is absent (old server) or empty while JSONB rows still exist.
 */
export function resolveSecondaryTenantContactsForDisplay(
  lease: IPropertyLongStay,
  apiContacts: ILeaseSecondaryTenantContact[] | undefined
): ILeaseSecondaryTenantContact[] {
  if (apiContacts != null && apiContacts.length > 0) {
    return apiContacts;
  }

  if (lease.secondaryTenants.length > 0) {
    return lease.secondaryTenants.map((tenant) => mapLegacyJsonbSecondaryTenantToContact(tenant));
  }

  return apiContacts ?? [];
}

export function resolveSecondaryPortalMembershipForContact(
  contact: ILeaseSecondaryTenantContact,
  memberships: readonly ILeaseTenantMembership[]
): ILeaseTenantMembership | null {
  if (contact.membershipId) {
    return memberships.find((membership) => membership.id === contact.membershipId) ?? null;
  }

  return findLeasePortalMembership(
    memberships,
    TenantMembershipRole.SECONDARY,
    contact.effectiveEmail
  );
}

export function getSecondaryPortalActingMembershipId(
  contact: ILeaseSecondaryTenantContact,
  index: number
): string {
  return contact.membershipId ?? `legacy-jsonb-${index}`;
}
