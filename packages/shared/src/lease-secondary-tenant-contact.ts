import type { IPropertyLongStaySecondaryTenant } from "./property-long-stay-types";
import { normalizeTenantEmail } from "./tenant-email-recipient-resolver";
import { isTerminalTenantMembershipStatus } from "./tenant-membership-transitions";
import {
  type ILeaseTenantMembership,
  type ITenantUser,
  TenantMembershipRole,
  TenantMembershipStatus,
  type TTenantMembershipStatus,
} from "./tenant-portal-types";

export type TSecondaryTenantContactSource =
  "legacy_jsonb" | "linked_user" | "membership_listed" | "membership_pending";

export interface ILeaseSecondaryTenantContact {
  effectiveEmail: string | null;
  effectiveName: string;
  effectivePhone: string | null;
  membershipId: string | null;
  source: TSecondaryTenantContactSource;
  status: TTenantMembershipStatus | null;
  tenantUserId: string | null;
}

export interface IResolveSecondaryTenantContactsForLeaseInput {
  jsonbOrphans?: readonly IPropertyLongStaySecondaryTenant[];
  memberships: readonly ILeaseTenantMembership[];
  tenantUsersById: ReadonlyMap<string, ITenantUser> | Readonly<Record<string, ITenantUser>>;
}

/** Map one legacy JSONB secondary tenant row to a display contact (transition / admin fallback). */
export function mapLegacyJsonbSecondaryTenantToContact(
  tenant: IPropertyLongStaySecondaryTenant
): ILeaseSecondaryTenantContact {
  return {
    effectiveEmail: tenant.email?.trim() ?? null,
    effectiveName: tenant.name,
    effectivePhone: tenant.phone,
    membershipId: null,
    source: "legacy_jsonb",
    status: null,
    tenantUserId: null,
  };
}

function membershipInviteEmail(membership: ILeaseTenantMembership): string | null {
  return membership.inviteEmail?.trim() || null;
}

function membershipDisplayName(membership: ILeaseTenantMembership): string {
  return membership.displayName.trim() || membershipInviteEmail(membership) || "";
}

const PENDING_MEMBERSHIP_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_ACCEPTANCE,
  TenantMembershipStatus.PENDING_INVITE,
]);

function getTenantUser(
  tenantUsersById: ReadonlyMap<string, ITenantUser> | Readonly<Record<string, ITenantUser>>,
  tenantUserId: string
): ITenantUser | null {
  if (tenantUsersById instanceof Map) {
    return tenantUsersById.get(tenantUserId) ?? null;
  }
  const users = tenantUsersById as Readonly<Record<string, ITenantUser | undefined>>;
  return users[tenantUserId] ?? null;
}

/**
 * Resolve effective contact fields for one non-terminal secondary membership row.
 */
export function resolveSecondaryTenantContact(
  membership: ILeaseTenantMembership,
  tenantUser: ITenantUser | null
): ILeaseSecondaryTenantContact | null {
  if (
    membership.role !== TenantMembershipRole.SECONDARY ||
    isTerminalTenantMembershipStatus(membership.status)
  ) {
    return null;
  }

  const membershipMeta = {
    membershipId: membership.id,
    status: membership.status,
    tenantUserId: membership.tenantUserId,
  };

  if (
    membership.status === TenantMembershipStatus.ACTIVE &&
    membership.tenantUserId != null &&
    tenantUser != null &&
    tenantUser.id === membership.tenantUserId
  ) {
    return {
      ...membershipMeta,
      effectiveEmail: tenantUser.email,
      effectiveName: tenantUser.name,
      effectivePhone: tenantUser.phone,
      source: "linked_user",
    };
  }

  if (membership.status === TenantMembershipStatus.LISTED) {
    return {
      ...membershipMeta,
      effectiveEmail: membershipInviteEmail(membership),
      effectiveName: membershipDisplayName(membership),
      effectivePhone: membership.contactPhone,
      source: "membership_listed",
    };
  }

  if (PENDING_MEMBERSHIP_STATUSES.has(membership.status)) {
    return {
      ...membershipMeta,
      effectiveEmail: membershipInviteEmail(membership),
      effectiveName: membershipDisplayName(membership),
      effectivePhone: membership.contactPhone,
      source: "membership_pending",
    };
  }

  if (membership.status === TenantMembershipStatus.ACTIVE) {
    return {
      ...membershipMeta,
      effectiveEmail: membershipInviteEmail(membership),
      effectiveName: membershipDisplayName(membership),
      effectivePhone: membership.contactPhone,
      source: "membership_pending",
    };
  }

  return null;
}

/**
 * Find a non-terminal secondary membership for a lease occupant by invite email.
 */
export function selectSecondaryMembershipForContact(
  memberships: readonly ILeaseTenantMembership[],
  inviteEmail: string
): ILeaseTenantMembership | null {
  const normalizedEmail = normalizeTenantEmail(inviteEmail);
  return (
    memberships.find(
      (membership) =>
        membership.role === TenantMembershipRole.SECONDARY &&
        !isTerminalTenantMembershipStatus(membership.status) &&
        membership.inviteEmail != null &&
        normalizeTenantEmail(membership.inviteEmail) === normalizedEmail
    ) ?? null
  );
}

/**
 * Resolve all secondary tenant contacts for a lease from memberships, optional linked users,
 * and optional legacy JSONB orphans during transition.
 */
export function resolveSecondaryTenantContactsForLease(
  input: IResolveSecondaryTenantContactsForLeaseInput
): ILeaseSecondaryTenantContact[] {
  const secondaryMemberships = input.memberships.filter(
    (membership) =>
      membership.role === TenantMembershipRole.SECONDARY &&
      !isTerminalTenantMembershipStatus(membership.status)
  );

  const contacts: ILeaseSecondaryTenantContact[] = [];
  const matchedEmails = new Set<string>();

  for (const membership of secondaryMemberships) {
    const tenantUser =
      membership.tenantUserId != null
        ? getTenantUser(input.tenantUsersById, membership.tenantUserId)
        : null;
    const contact = resolveSecondaryTenantContact(membership, tenantUser);
    if (!contact) continue;

    contacts.push(contact);
    if (contact.effectiveEmail) {
      matchedEmails.add(normalizeTenantEmail(contact.effectiveEmail));
    }
  }

  for (const orphan of input.jsonbOrphans ?? []) {
    const email = orphan.email?.trim();
    if (email && matchedEmails.has(normalizeTenantEmail(email))) {
      continue;
    }

    contacts.push(mapLegacyJsonbSecondaryTenantToContact(orphan));

    if (email) {
      matchedEmails.add(normalizeTenantEmail(email));
    }
  }

  return contacts;
}
