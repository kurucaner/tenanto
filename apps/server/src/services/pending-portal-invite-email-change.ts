import {
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  isValidTenantEmail,
  normalizeTenantEmail,
  TenantMembershipStatus,
  type TTenantMembershipStatus,
} from "@/packages/shared";

import { tenantPortalInviteService } from "./tenant-portal-invite-service";

const PENDING_MEMBERSHIP_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_ACCEPTANCE,
  TenantMembershipStatus.PENDING_INVITE,
]);

function normalizeComparableInviteEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim() || null;
  if (!trimmed) {
    return null;
  }
  return normalizeTenantEmail(trimmed);
}

/**
 * After lease/membership contact fields are updated: if a pending invite's email
 * changed, retarget (rotate token + reclassify + SES) or revoke when cleared.
 * No-op when email is unchanged or membership is not pending.
 */
export async function applyPendingPortalInviteEmailChange(input: {
  lease: IPropertyLongStay;
  membership: ILeaseTenantMembership;
  nextInviteEmail: string | null;
  previousInviteEmail: string | null | undefined;
}): Promise<void> {
  if (!PENDING_MEMBERSHIP_STATUSES.has(input.membership.status)) {
    return;
  }

  const previous = normalizeComparableInviteEmail(input.previousInviteEmail);
  const next = normalizeComparableInviteEmail(input.nextInviteEmail);
  if (previous === next) {
    return;
  }

  if (next == null) {
    await tenantPortalInviteService.revokeInvite({
      leaseId: input.lease.id,
      membershipId: input.membership.id,
      propertyId: input.lease.propertyId,
    });
    return;
  }

  if (!isValidTenantEmail(next)) {
    return;
  }

  await tenantPortalInviteService.retargetPendingInvite({
    inviteEmail: next,
    leaseId: input.lease.id,
    membershipId: input.membership.id,
    propertyId: input.lease.propertyId,
  });
}
