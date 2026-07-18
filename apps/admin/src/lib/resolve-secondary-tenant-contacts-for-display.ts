import {
  type ILeaseSecondaryTenantContact,
  type ILeaseTenantMembership,
} from "@/packages/shared";

export function resolveSecondaryTenantContactsForDisplay(
  apiContacts: ILeaseSecondaryTenantContact[] | undefined
): ILeaseSecondaryTenantContact[] {
  return apiContacts ?? [];
}

export function resolveSecondaryPortalMembershipForContact(
  contact: ILeaseSecondaryTenantContact,
  memberships: readonly ILeaseTenantMembership[]
): ILeaseTenantMembership | null {
  if (!contact.membershipId) {
    return null;
  }

  return memberships.find((membership) => membership.id === contact.membershipId) ?? null;
}

export function getSecondaryPortalActingMembershipId(
  contact: ILeaseSecondaryTenantContact
): string {
  if (!contact.membershipId) {
    throw new Error("Secondary tenant contact is missing membership id");
  }

  return contact.membershipId;
}
