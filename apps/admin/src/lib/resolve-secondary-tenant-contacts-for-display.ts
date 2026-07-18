import {
  type ILeaseSecondaryTenantContact,
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  TenantMembershipRole,
} from "@/packages/shared";

import { findLeasePortalMembership } from "./lease-portal-access-display";

export function resolveSecondaryTenantContactsForDisplay(
  _lease: IPropertyLongStay,
  apiContacts: ILeaseSecondaryTenantContact[] | undefined
): ILeaseSecondaryTenantContact[] {
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
