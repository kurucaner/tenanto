import { selectSecondaryMembershipForContact } from "./lease-secondary-tenant-contact";
import type { IPropertyLongStaySecondaryTenant } from "./property-long-stay-types";
import { isValidTenantEmail, normalizeTenantEmail } from "./tenant-email-recipient-resolver";
import { isTerminalTenantMembershipStatus } from "./tenant-membership-transitions";
import {
  type ILeaseTenantMembership,
  TenantMembershipRole,
  TenantMembershipStatus,
  type TTenantMembershipStatus,
} from "./tenant-portal-types";

export type TSecondaryBackfillActionKind =
  | "insert_listed"
  | "log_email_drift"
  | "log_orphan_membership"
  | "skip_active_linked"
  | "skip_duplicate_jsonb"
  | "skip_invalid_jsonb"
  | "skip_noop"
  | "update_contact";

export interface ISecondaryBackfillJsonbTenant {
  contactPhone: string | null;
  displayName: string;
  email: string | null;
}

export interface ISecondaryBackfillPlannedAction {
  contactPhone: string | null;
  displayName: string;
  email: string | null;
  kind: TSecondaryBackfillActionKind;
  membershipId: string | null;
  message: string | null;
}

export interface ISecondaryBackfillLeasePlan {
  actions: ISecondaryBackfillPlannedAction[];
  canonicalJsonbTenants: ISecondaryBackfillJsonbTenant[];
  leaseId: string;
}

export interface ISecondaryBackfillVerificationGap {
  jsonbEmails: string[];
  leaseId: string;
  membershipEmails: string[];
  message: string;
  orphanMembershipEmails: string[];
  unmatchedJsonbEmails: string[];
}

export interface ISecondaryBackfillVerificationResult {
  gapCount: number;
  gaps: ISecondaryBackfillVerificationGap[];
  ok: boolean;
}

const PENDING_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_ACCEPTANCE,
  TenantMembershipStatus.PENDING_INVITE,
]);

function normalizeJsonbEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim() ?? "";
  if (!trimmed || !isValidTenantEmail(trimmed)) {
    return null;
  }
  return normalizeTenantEmail(trimmed);
}

/**
 * Deduplicate JSONB secondaries by normalized email (first row wins).
 */
export function canonicalizeJsonbSecondaryTenants(
  jsonbTenants: readonly IPropertyLongStaySecondaryTenant[]
): {
  canonical: ISecondaryBackfillJsonbTenant[];
  duplicateEmails: string[];
  invalidEntries: number;
} {
  const canonical: ISecondaryBackfillJsonbTenant[] = [];
  const duplicateEmails: string[] = [];
  const seenEmails = new Set<string>();
  let invalidEntries = 0;

  for (const tenant of jsonbTenants) {
    const displayName = tenant.name?.trim() ?? "";
    const normalizedEmail = normalizeJsonbEmail(tenant.email);
    if (!displayName) {
      invalidEntries += 1;
      continue;
    }

    if (normalizedEmail && seenEmails.has(normalizedEmail)) {
      duplicateEmails.push(normalizedEmail);
      continue;
    }

    if (normalizedEmail) {
      seenEmails.add(normalizedEmail);
    }
    canonical.push({
      contactPhone: tenant.phone?.trim() ? tenant.phone.trim() : null,
      displayName,
      email: normalizedEmail,
    });
  }

  return { canonical, duplicateEmails, invalidEntries };
}

function membershipNeedsContactUpdate(
  membership: ILeaseTenantMembership,
  jsonbTenant: ISecondaryBackfillJsonbTenant
): boolean {
  const nextDisplayName = jsonbTenant.displayName.trim();
  const currentDisplayName = membership.displayName.trim();
  const nextPhone = jsonbTenant.contactPhone;
  const currentPhone = membership.contactPhone;

  return currentDisplayName !== nextDisplayName || currentPhone !== nextPhone;
}

export function planSecondaryTenantBackfillForLease(input: {
  jsonbTenants: readonly IPropertyLongStaySecondaryTenant[];
  leaseId: string;
  memberships: readonly ILeaseTenantMembership[];
}): ISecondaryBackfillLeasePlan {
  const secondaryMemberships = input.memberships.filter(
    (membership) => membership.role === TenantMembershipRole.SECONDARY
  );
  const { canonical, duplicateEmails, invalidEntries } = canonicalizeJsonbSecondaryTenants(
    input.jsonbTenants
  );

  const actions: ISecondaryBackfillPlannedAction[] = [];

  if (invalidEntries > 0) {
    actions.push({
      contactPhone: null,
      displayName: "",
      email: "",
      kind: "skip_invalid_jsonb",
      membershipId: null,
      message: `Skipped ${invalidEntries} JSONB row(s) without a valid name`,
    });
  }

  for (const duplicateEmail of duplicateEmails) {
    actions.push({
      contactPhone: null,
      displayName: "",
      email: duplicateEmail,
      kind: "skip_duplicate_jsonb",
      membershipId: null,
      message: "Duplicate JSONB email on lease; kept first row only",
    });
  }

  for (const jsonbTenant of canonical) {
    const membership = jsonbTenant.email
      ? selectSecondaryMembershipForContact(secondaryMemberships, jsonbTenant.email)
      : null;

    if (!membership) {
      actions.push({
        contactPhone: jsonbTenant.contactPhone,
        displayName: jsonbTenant.displayName,
        email: jsonbTenant.email,
        kind: "insert_listed",
        membershipId: null,
        message: null,
      });
      continue;
    }

    if (jsonbTenant.email && membership.inviteEmail) {
      const membershipEmail = normalizeTenantEmail(membership.inviteEmail);
      if (membershipEmail !== jsonbTenant.email) {
        actions.push({
          contactPhone: jsonbTenant.contactPhone,
          displayName: jsonbTenant.displayName,
          email: jsonbTenant.email,
          kind: "log_email_drift",
          membershipId: membership.id,
          message: `Membership invite_email ${membershipEmail} differs from JSONB ${jsonbTenant.email}; kept membership email`,
        });
      }
    }

    if (membership.status === TenantMembershipStatus.ACTIVE && membership.tenantUserId != null) {
      actions.push({
        contactPhone: jsonbTenant.contactPhone,
        displayName: jsonbTenant.displayName,
        email: jsonbTenant.email,
        kind: "skip_active_linked",
        membershipId: membership.id,
        message: null,
      });
      continue;
    }

    if (
      PENDING_STATUSES.has(membership.status) ||
      membership.status === TenantMembershipStatus.LISTED
    ) {
      if (!membershipNeedsContactUpdate(membership, jsonbTenant)) {
        actions.push({
          contactPhone: jsonbTenant.contactPhone,
          displayName: jsonbTenant.displayName,
          email: jsonbTenant.email,
          kind: "skip_noop",
          membershipId: membership.id,
          message: null,
        });
        continue;
      }

      actions.push({
        contactPhone: jsonbTenant.contactPhone,
        displayName: jsonbTenant.displayName,
        email: jsonbTenant.email,
        kind: "update_contact",
        membershipId: membership.id,
        message: null,
      });
      continue;
    }

    actions.push({
      contactPhone: jsonbTenant.contactPhone,
      displayName: jsonbTenant.displayName,
      email: jsonbTenant.email,
      kind: "insert_listed",
      membershipId: membership.id,
      message: `Existing membership is terminal (${membership.status}); inserting new listed row`,
    });
  }

  return {
    actions,
    canonicalJsonbTenants: canonical,
    leaseId: input.leaseId,
  };
}

export function verifySecondaryTenantBackfillForLease(input: {
  jsonbTenants: readonly IPropertyLongStaySecondaryTenant[];
  leaseId: string;
  memberships: readonly ILeaseTenantMembership[];
}): ISecondaryBackfillVerificationGap | null {
  const { canonical } = canonicalizeJsonbSecondaryTenants(input.jsonbTenants);
  const jsonbEmails = new Set(
    canonical
      .map((tenant) => tenant.email)
      .filter((email): email is string => email != null)
  );

  const membershipEmails = new Set(
    input.memberships
      .filter(
        (membership) =>
          membership.role === TenantMembershipRole.SECONDARY &&
          !isTerminalTenantMembershipStatus(membership.status) &&
          membership.inviteEmail != null
      )
      .map((membership) => normalizeTenantEmail(membership.inviteEmail as string))
  );

  const unmatchedJsonbEmails = [...jsonbEmails].filter((email) => !membershipEmails.has(email));
  const orphanMembershipEmails = [...membershipEmails].filter((email) => !jsonbEmails.has(email));

  if (unmatchedJsonbEmails.length === 0 && orphanMembershipEmails.length === 0) {
    return null;
  }

  const messages: string[] = [];
  if (unmatchedJsonbEmails.length > 0) {
    messages.push(`${unmatchedJsonbEmails.length} JSONB email(s) without membership row`);
  }
  if (orphanMembershipEmails.length > 0) {
    messages.push(`${orphanMembershipEmails.length} membership email(s) without JSONB row`);
  }

  return {
    jsonbEmails: [...jsonbEmails].sort((a, b) => a.localeCompare(b)),
    leaseId: input.leaseId,
    membershipEmails: [...membershipEmails].sort((a, b) => a.localeCompare(b)),
    message: messages.join("; "),
    orphanMembershipEmails: orphanMembershipEmails.sort((a, b) => a.localeCompare(b)),
    unmatchedJsonbEmails: unmatchedJsonbEmails.sort((a, b) => a.localeCompare(b)),
  };
}

export function summarizeSecondaryBackfillVerification(
  gaps: readonly ISecondaryBackfillVerificationGap[]
): ISecondaryBackfillVerificationResult {
  return {
    gapCount: gaps.length,
    gaps: [...gaps],
    ok: gaps.length === 0,
  };
}
