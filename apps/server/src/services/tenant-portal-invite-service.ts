import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";
import { propertiesDb } from "@/db/properties";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import { tenantUsersDb } from "@/db/tenant-users";
import {
  duplicatePortalInviteError,
  portalInviteInvalidStateError,
  portalInviteLeaseMismatchError,
  portalInviteNotFoundError,
  portalInviteTargetError,
} from "@/errors/portal-invite-errors";
import { buildTenantInviteLeaseSummary } from "@/lib/build-tenant-invite-lease-summary";
import {
  type ICreateLeasePortalInviteResult,
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  isValidTenantEmail,
  type ITenantInviteLeaseSummary,
  type ITenantInvitePreviewResponse,
  normalizeTenantEmail,
  requireMembershipInviteEmail,
  TenantMembershipRole,
  TenantMembershipStatus,
  type TTenantMembershipRole,
  type TTenantMembershipStatus,
} from "@/packages/shared";
import {
  buildPortalInviteAcceptUrl,
  generatePortalInviteToken,
  hashPortalInviteToken,
} from "@/ses/tenant-portal-invite-token";
import {
  sendTenantPortalInviteExistingEmail,
  sendTenantPortalInviteNewEmail,
} from "@/ses/transactional-emails";

import { resolveSecondaryTenantContactsForLongStay } from "./resolve-secondary-tenant-contacts-service";
import {
  logTenantPortalInvited,
  logTenantPortalResent,
  logTenantPortalRetargeted,
  logTenantPortalRevoked,
} from "./tenant-portal-observability";
import { WinstonLogger } from "./winston";

const PENDING_PREVIEW_STATUSES = new Set<string>([
  TenantMembershipStatus.PENDING_INVITE,
  TenantMembershipStatus.PENDING_ACCEPTANCE,
]);

const PENDING_INVITE_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_INVITE,
  TenantMembershipStatus.PENDING_ACCEPTANCE,
]);

const SECONDARY_INVITE_ELIGIBLE_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.EXPIRED,
  TenantMembershipStatus.LISTED,
  TenantMembershipStatus.REVOKED,
]);

async function loadLeaseContext(leaseId: string, propertyId: string) {
  const lease = await propertyLongStaysDb.findById(leaseId);
  if (!lease || lease.propertyId !== propertyId) {
    return null;
  }

  const [property, unit] = await Promise.all([
    propertiesDb.findById(propertyId),
    propertyUnitsDb.findById(lease.unitId),
  ]);
  if (!property || !unit) {
    return null;
  }

  return { lease, property, unit };
}

async function resolveInitialStatus(
  inviteEmail: string
): Promise<
  typeof TenantMembershipStatus.PENDING_INVITE | typeof TenantMembershipStatus.PENDING_ACCEPTANCE
> {
  const existingUser = await tenantUsersDb.findByEmail(inviteEmail);
  return existingUser
    ? TenantMembershipStatus.PENDING_ACCEPTANCE
    : TenantMembershipStatus.PENDING_INVITE;
}

async function sendPortalInviteEmail(
  membership: ILeaseTenantMembership,
  summary: ITenantInviteLeaseSummary,
  rawToken: string,
  hasExistingAccount: boolean
): Promise<{ emailError?: string; emailSent: boolean }> {
  const inviteEmail = requireMembershipInviteEmail(membership.inviteEmail);
  const acceptUrl = buildPortalInviteAcceptUrl(rawToken);
  try {
    const emailSent = hasExistingAccount
      ? await sendTenantPortalInviteExistingEmail(inviteEmail, {
          acceptUrl,
          displayName: summary.displayName,
          propertyName: summary.propertyName,
          unitLabel: summary.unitLabel,
        })
      : await sendTenantPortalInviteNewEmail(inviteEmail, {
          acceptUrl,
          displayName: summary.displayName,
          propertyName: summary.propertyName,
          unitLabel: summary.unitLabel,
        });
    return { emailSent };
  } catch (error) {
    const emailError = error instanceof Error ? error.message : "Failed to send invite email";
    return { emailError, emailSent: false };
  }
}

async function createAndSendInvite(input: {
  displayName: string;
  inviteEmail: string;
  invitedBy: string;
  leaseId: string;
  propertyId: string;
  role: TTenantMembershipRole;
}): Promise<ICreateLeasePortalInviteResult> {
  const context = await loadLeaseContext(input.leaseId, input.propertyId);
  if (!context) {
    throw portalInviteNotFoundError("Long stay not found");
  }

  const status = await resolveInitialStatus(input.inviteEmail);
  const existingUser = await tenantUsersDb.findByEmail(input.inviteEmail);
  const rawToken = generatePortalInviteToken();
  const inviteTokenHash = hashPortalInviteToken(rawToken);

  const membership = await leaseTenantMembershipsDb.create({
    displayName: input.displayName,
    invitedBy: input.invitedBy,
    inviteEmail: input.inviteEmail,
    inviteTokenHash,
    leaseId: input.leaseId,
    role: input.role,
    status,
    tenantUserId: existingUser?.id ?? null,
  });

  const summary = buildTenantInviteLeaseSummary(
    membership,
    context.lease,
    context.property,
    context.unit
  );
  const emailResult = await sendPortalInviteEmail(
    membership,
    summary,
    rawToken,
    existingUser != null
  );

  logTenantPortalInvited(membership);

  return {
    emailError: emailResult.emailError,
    emailSent: emailResult.emailSent,
    membership,
  };
}

function resolvePrimaryInviteTarget(lease: IPropertyLongStay): {
  displayName: string;
  email: string;
} {
  const email = lease.tenantEmail?.trim() ?? "";
  if (!email || !isValidTenantEmail(email)) {
    throw portalInviteTargetError("Primary tenant email is missing or invalid");
  }
  return {
    displayName: lease.guestName.trim(),
    email: normalizeTenantEmail(email),
  };
}

async function resolveSecondaryMembershipIdFromIndex(
  leaseId: string,
  propertyId: string,
  index: number
): Promise<string> {
  const context = await loadLeaseContext(leaseId, propertyId);
  if (!context) {
    throw portalInviteNotFoundError("Long stay not found");
  }

  const contacts = await resolveSecondaryTenantContactsForLongStay(context.lease);
  const contact = contacts[index];
  if (!contact) {
    throw portalInviteTargetError(`secondaryIndexes contains invalid index ${index}`);
  }
  if (!contact.membershipId) {
    throw portalInviteTargetError(
      `Secondary tenant at index ${index} has no membership; add the occupant before inviting`
    );
  }
  return contact.membershipId;
}

async function transitionAndSendSecondaryInvite(input: {
  leaseId: string;
  membershipId: string;
  propertyId: string;
}): Promise<ICreateLeasePortalInviteResult> {
  const context = await loadLeaseContext(input.leaseId, input.propertyId);
  if (!context) {
    throw portalInviteNotFoundError("Long stay not found");
  }

  const membership = await leaseTenantMembershipsDb.findById(input.membershipId);
  if (!membership || membership.leaseId !== input.leaseId) {
    throw portalInviteLeaseMismatchError();
  }

  if (membership.role !== TenantMembershipRole.SECONDARY) {
    throw portalInviteTargetError("Membership is not a secondary occupant");
  }

  if (PENDING_INVITE_STATUSES.has(membership.status)) {
    throw duplicatePortalInviteError(membership);
  }

  if (!SECONDARY_INVITE_ELIGIBLE_STATUSES.has(membership.status)) {
    throw portalInviteInvalidStateError(
      "Only listed or previously expired/revoked secondary occupants can be invited"
    );
  }

  const inviteEmail = membership.inviteEmail?.trim() ?? "";
  if (!inviteEmail || !isValidTenantEmail(inviteEmail)) {
    throw portalInviteTargetError("Secondary occupant has no valid email");
  }

  const status = await resolveInitialStatus(inviteEmail);
  const existingUser = await tenantUsersDb.findByEmail(inviteEmail);

  let updated = await leaseTenantMembershipsDb.transitionStatus(membership.id, status);
  if (!updated) {
    throw portalInviteNotFoundError("Portal invite not found");
  }

  if (status === TenantMembershipStatus.PENDING_ACCEPTANCE && existingUser) {
    updated =
      (await leaseTenantMembershipsDb.linkTenantUser(membership.id, existingUser.id)) ?? updated;
  }

  const rawToken = generatePortalInviteToken();
  updated =
    (await leaseTenantMembershipsDb.updateInviteToken(
      membership.id,
      hashPortalInviteToken(rawToken)
    )) ?? updated;

  const summary = buildTenantInviteLeaseSummary(
    updated,
    context.lease,
    context.property,
    context.unit
  );
  const emailResult = await sendPortalInviteEmail(updated, summary, rawToken, existingUser != null);

  logTenantPortalInvited(updated);

  return {
    emailError: emailResult.emailError,
    emailSent: emailResult.emailSent,
    membership: updated,
  };
}

export const tenantPortalInviteService = {
  async autoInvitePrimaryOnLeaseCreate(input: {
    invitedBy: string;
    lease: IPropertyLongStay;
    propertyId: string;
  }): Promise<ICreateLeasePortalInviteResult | null> {
    const email = input.lease.tenantEmail?.trim() ?? "";
    if (!isValidTenantEmail(email)) {
      return null;
    }

    try {
      const results = await tenantPortalInviteService.createInvites({
        invitedBy: input.invitedBy,
        invitePrimary: true,
        leaseId: input.lease.id,
        propertyId: input.propertyId,
      });
      return results[0] ?? null;
    } catch (error) {
      WinstonLogger.error("tenant_portal.auto_invite_on_lease_create_failed", {
        error: error instanceof Error ? error.message : String(error),
        leaseId: input.lease.id,
        propertyId: input.propertyId,
      });
      return null;
    }
  },

  async createInvites(input: {
    invitedBy: string;
    invitePrimary?: boolean;
    leaseId: string;
    propertyId: string;
    secondaryIndexes?: number[];
    secondaryMembershipIds?: string[];
  }): Promise<ICreateLeasePortalInviteResult[]> {
    const context = await loadLeaseContext(input.leaseId, input.propertyId);
    if (!context) {
      throw portalInviteNotFoundError("Long stay not found");
    }

    const invitePrimary = input.invitePrimary === true;
    const secondaryMembershipIds = [...(input.secondaryMembershipIds ?? [])];
    for (const index of input.secondaryIndexes ?? []) {
      secondaryMembershipIds.push(
        await resolveSecondaryMembershipIdFromIndex(input.leaseId, input.propertyId, index)
      );
    }

    if (!invitePrimary && secondaryMembershipIds.length === 0) {
      throw portalInviteTargetError(
        "At least one of invitePrimary, secondaryMembershipIds, or secondaryIndexes is required"
      );
    }

    const results: ICreateLeasePortalInviteResult[] = [];

    if (invitePrimary) {
      const primary = resolvePrimaryInviteTarget(context.lease);
      results.push(
        await createAndSendInvite({
          displayName: primary.displayName,
          invitedBy: input.invitedBy,
          inviteEmail: primary.email,
          leaseId: input.leaseId,
          propertyId: input.propertyId,
          role: TenantMembershipRole.PRIMARY,
        })
      );
    }

    for (const membershipId of secondaryMembershipIds) {
      results.push(
        await transitionAndSendSecondaryInvite({
          leaseId: input.leaseId,
          membershipId,
          propertyId: input.propertyId,
        })
      );
    }

    return results;
  },

  async listPortalAccess(leaseId: string, propertyId: string): Promise<ILeaseTenantMembership[]> {
    const context = await loadLeaseContext(leaseId, propertyId);
    if (!context) {
      throw portalInviteNotFoundError("Long stay not found");
    }
    // Lazy TTL sweep so admin Tenants tab status matches DB without waiting for cron.
    await leaseTenantMembershipsDb.expirePendingPortalInvites();
    return leaseTenantMembershipsDb.findByLeaseId(leaseId);
  },

  async previewInvite(token: string): Promise<ITenantInvitePreviewResponse> {
    const membership = await leaseTenantMembershipsDb.findByInviteToken(token);
    if (!membership) {
      throw portalInviteNotFoundError("Invalid or expired invite link");
    }

    if (!PENDING_PREVIEW_STATUSES.has(membership.status)) {
      throw portalInviteInvalidStateError("This invite is no longer available");
    }

    const expired = await leaseTenantMembershipsDb.expireMembershipIfPastTtl(membership);
    if (expired) {
      throw portalInviteInvalidStateError("This invite has expired");
    }

    const lease = await propertyLongStaysDb.findById(membership.leaseId);
    if (!lease) {
      throw portalInviteNotFoundError("Lease not found");
    }

    const [property, unit] = await Promise.all([
      propertiesDb.findById(lease.propertyId),
      propertyUnitsDb.findById(lease.unitId),
    ]);
    if (!property || !unit) {
      throw portalInviteNotFoundError("Lease not found");
    }

    const inviteEmail = requireMembershipInviteEmail(membership.inviteEmail);
    const hasExistingAccount = (await tenantUsersDb.findByEmail(inviteEmail)) != null;

    return {
      hasExistingAccount,
      inviteEmail,
      membershipId: membership.id,
      status: membership.status,
      summary: buildTenantInviteLeaseSummary(membership, lease, property, unit),
    };
  },

  async resendInvite(input: {
    leaseId: string;
    membershipId: string;
    propertyId: string;
  }): Promise<ICreateLeasePortalInviteResult> {
    const context = await loadLeaseContext(input.leaseId, input.propertyId);
    if (!context) {
      throw portalInviteNotFoundError("Long stay not found");
    }

    const membership = await leaseTenantMembershipsDb.findById(input.membershipId);
    if (!membership || membership.leaseId !== input.leaseId) {
      throw portalInviteLeaseMismatchError();
    }

    if (
      membership.status !== TenantMembershipStatus.PENDING_INVITE &&
      membership.status !== TenantMembershipStatus.PENDING_ACCEPTANCE
    ) {
      throw portalInviteInvalidStateError("Only pending portal invites can be resent");
    }

    const rawToken = generatePortalInviteToken();
    const updated = await leaseTenantMembershipsDb.updateInviteToken(
      membership.id,
      hashPortalInviteToken(rawToken)
    );
    if (!updated) {
      throw portalInviteNotFoundError("Portal invite not found");
    }

    const summary = buildTenantInviteLeaseSummary(
      updated,
      context.lease,
      context.property,
      context.unit
    );
    const inviteEmail = requireMembershipInviteEmail(updated.inviteEmail);
    const hasExistingAccount =
      updated.status === TenantMembershipStatus.PENDING_ACCEPTANCE ||
      (await tenantUsersDb.findByEmail(inviteEmail)) != null;
    const emailResult = await sendPortalInviteEmail(updated, summary, rawToken, hasExistingAccount);

    logTenantPortalResent(updated);

    return {
      emailError: emailResult.emailError,
      emailSent: emailResult.emailSent,
      membership: updated,
    };
  },

  /**
   * Retarget a pending invite to a new email on the same membership row:
   * reclassify pending_invite ↔ pending_acceptance, relink tenant_user_id,
   * rotate token, and send invite email. Does not use create rate limits.
   */
  async retargetPendingInvite(input: {
    inviteEmail: string;
    leaseId: string;
    membershipId: string;
    propertyId: string;
  }): Promise<ICreateLeasePortalInviteResult> {
    const context = await loadLeaseContext(input.leaseId, input.propertyId);
    if (!context) {
      throw portalInviteNotFoundError("Long stay not found");
    }

    const membership = await leaseTenantMembershipsDb.findById(input.membershipId);
    if (!membership || membership.leaseId !== input.leaseId) {
      throw portalInviteLeaseMismatchError();
    }

    if (!PENDING_INVITE_STATUSES.has(membership.status)) {
      throw portalInviteInvalidStateError("Only pending portal invites can be retargeted");
    }

    const inviteEmail = normalizeTenantEmail(input.inviteEmail.trim());
    if (!isValidTenantEmail(inviteEmail)) {
      throw portalInviteTargetError("A valid invite email is required");
    }

    const duplicate = await leaseTenantMembershipsDb.findNonTerminalByLeaseEmailRole(
      input.leaseId,
      inviteEmail,
      membership.role
    );
    if (duplicate && duplicate.id !== membership.id) {
      throw duplicatePortalInviteError(duplicate);
    }

    const status = await resolveInitialStatus(inviteEmail);
    const existingUser = await tenantUsersDb.findByEmail(inviteEmail);
    const rawToken = generatePortalInviteToken();
    const updated = await leaseTenantMembershipsDb.retargetPendingInvite(membership.id, {
      inviteEmail,
      inviteTokenHash: hashPortalInviteToken(rawToken),
      status,
      tenantUserId:
        status === TenantMembershipStatus.PENDING_ACCEPTANCE && existingUser
          ? existingUser.id
          : null,
    });
    if (!updated) {
      throw portalInviteNotFoundError("Portal invite not found");
    }

    const summary = buildTenantInviteLeaseSummary(
      updated,
      context.lease,
      context.property,
      context.unit
    );
    const emailResult = await sendPortalInviteEmail(
      updated,
      summary,
      rawToken,
      existingUser != null
    );

    logTenantPortalRetargeted(updated);

    return {
      emailError: emailResult.emailError,
      emailSent: emailResult.emailSent,
      membership: updated,
    };
  },

  async revokeInvite(input: {
    leaseId: string;
    membershipId: string;
    propertyId: string;
  }): Promise<ILeaseTenantMembership> {
    const context = await loadLeaseContext(input.leaseId, input.propertyId);
    if (!context) {
      throw portalInviteNotFoundError("Long stay not found");
    }

    const membership = await leaseTenantMembershipsDb.findById(input.membershipId);
    if (!membership || membership.leaseId !== input.leaseId) {
      throw portalInviteLeaseMismatchError();
    }

    if (
      membership.status !== TenantMembershipStatus.ACTIVE &&
      membership.status !== TenantMembershipStatus.PENDING_INVITE &&
      membership.status !== TenantMembershipStatus.PENDING_ACCEPTANCE
    ) {
      throw portalInviteInvalidStateError("This portal invite cannot be revoked");
    }

    const updated = await leaseTenantMembershipsDb.transitionStatus(
      membership.id,
      TenantMembershipStatus.REVOKED
    );
    if (!updated) {
      throw portalInviteNotFoundError("Portal invite not found");
    }

    logTenantPortalRevoked(updated);
    return updated;
  },
};
