import {
  DuplicatePortalInviteError,
  leaseTenantMembershipsDb,
} from "@/db/lease-tenant-memberships";
import { propertiesDb } from "@/db/properties";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import { tenantUsersDb } from "@/db/tenant-users";
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
  logTenantPortalRevoked,
} from "./tenant-portal-observability";
import { WinstonLogger } from "./winston";

export class PortalInviteNotFoundError extends Error {
  constructor(message = "Portal invite not found") {
    super(message);
    this.name = "PortalInviteNotFoundError";
  }
}

export class PortalInviteLeaseMismatchError extends Error {
  constructor(message = "Portal invite does not belong to this lease") {
    super(message);
    this.name = "PortalInviteLeaseMismatchError";
  }
}

export class PortalInviteInvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalInviteInvalidStateError";
  }
}

export class PortalInviteTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalInviteTargetError";
  }
}

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
    throw new PortalInviteNotFoundError("Long stay not found");
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
    throw new PortalInviteTargetError("Primary tenant email is missing or invalid");
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
    throw new PortalInviteNotFoundError("Long stay not found");
  }

  const contacts = await resolveSecondaryTenantContactsForLongStay(context.lease);
  const contact = contacts[index];
  if (!contact) {
    throw new PortalInviteTargetError(`secondaryIndexes contains invalid index ${index}`);
  }
  if (!contact.membershipId) {
    throw new PortalInviteTargetError(
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
    throw new PortalInviteNotFoundError("Long stay not found");
  }

  const membership = await leaseTenantMembershipsDb.findById(input.membershipId);
  if (!membership || membership.leaseId !== input.leaseId) {
    throw new PortalInviteLeaseMismatchError();
  }

  if (membership.role !== TenantMembershipRole.SECONDARY) {
    throw new PortalInviteTargetError("Membership is not a secondary occupant");
  }

  if (PENDING_INVITE_STATUSES.has(membership.status)) {
    throw new DuplicatePortalInviteError(membership);
  }

  if (!SECONDARY_INVITE_ELIGIBLE_STATUSES.has(membership.status)) {
    throw new PortalInviteInvalidStateError(
      "Only listed or previously expired/revoked secondary occupants can be invited"
    );
  }

  const inviteEmail = membership.inviteEmail?.trim() ?? "";
  if (!inviteEmail || !isValidTenantEmail(inviteEmail)) {
    throw new PortalInviteTargetError("Secondary occupant has no valid email");
  }

  const status = await resolveInitialStatus(inviteEmail);
  const existingUser = await tenantUsersDb.findByEmail(inviteEmail);

  let updated = await leaseTenantMembershipsDb.transitionStatus(membership.id, status);
  if (!updated) {
    throw new PortalInviteNotFoundError("Portal invite not found");
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
      throw new PortalInviteNotFoundError("Long stay not found");
    }

    const invitePrimary = input.invitePrimary === true;
    const secondaryMembershipIds = [...(input.secondaryMembershipIds ?? [])];
    for (const index of input.secondaryIndexes ?? []) {
      secondaryMembershipIds.push(
        await resolveSecondaryMembershipIdFromIndex(input.leaseId, input.propertyId, index)
      );
    }

    if (!invitePrimary && secondaryMembershipIds.length === 0) {
      throw new PortalInviteTargetError(
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
      throw new PortalInviteNotFoundError("Long stay not found");
    }
    // Lazy TTL sweep so admin Tenants tab status matches DB without waiting for cron.
    await leaseTenantMembershipsDb.expirePendingPortalInvites();
    return leaseTenantMembershipsDb.findByLeaseId(leaseId);
  },

  async previewInvite(token: string): Promise<ITenantInvitePreviewResponse> {
    const membership = await leaseTenantMembershipsDb.findByInviteToken(token);
    if (!membership) {
      throw new PortalInviteNotFoundError("Invalid or expired invite link");
    }

    if (!PENDING_PREVIEW_STATUSES.has(membership.status)) {
      throw new PortalInviteInvalidStateError("This invite is no longer available");
    }

    const expired = await leaseTenantMembershipsDb.expireMembershipIfPastTtl(membership);
    if (expired) {
      throw new PortalInviteInvalidStateError("This invite has expired");
    }

    const lease = await propertyLongStaysDb.findById(membership.leaseId);
    if (!lease) {
      throw new PortalInviteNotFoundError("Lease not found");
    }

    const [property, unit] = await Promise.all([
      propertiesDb.findById(lease.propertyId),
      propertyUnitsDb.findById(lease.unitId),
    ]);
    if (!property || !unit) {
      throw new PortalInviteNotFoundError("Lease not found");
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
      throw new PortalInviteNotFoundError("Long stay not found");
    }

    const membership = await leaseTenantMembershipsDb.findById(input.membershipId);
    if (!membership || membership.leaseId !== input.leaseId) {
      throw new PortalInviteLeaseMismatchError();
    }

    if (
      membership.status !== TenantMembershipStatus.PENDING_INVITE &&
      membership.status !== TenantMembershipStatus.PENDING_ACCEPTANCE
    ) {
      throw new PortalInviteInvalidStateError("Only pending portal invites can be resent");
    }

    const rawToken = generatePortalInviteToken();
    const updated = await leaseTenantMembershipsDb.updateInviteToken(
      membership.id,
      hashPortalInviteToken(rawToken)
    );
    if (!updated) {
      throw new PortalInviteNotFoundError("Portal invite not found");
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

  async revokeInvite(input: {
    leaseId: string;
    membershipId: string;
    propertyId: string;
  }): Promise<ILeaseTenantMembership> {
    const context = await loadLeaseContext(input.leaseId, input.propertyId);
    if (!context) {
      throw new PortalInviteNotFoundError("Long stay not found");
    }

    const membership = await leaseTenantMembershipsDb.findById(input.membershipId);
    if (!membership || membership.leaseId !== input.leaseId) {
      throw new PortalInviteLeaseMismatchError();
    }

    if (
      membership.status !== TenantMembershipStatus.ACTIVE &&
      membership.status !== TenantMembershipStatus.PENDING_INVITE &&
      membership.status !== TenantMembershipStatus.PENDING_ACCEPTANCE
    ) {
      throw new PortalInviteInvalidStateError("This portal invite cannot be revoked");
    }

    const updated = await leaseTenantMembershipsDb.transitionStatus(
      membership.id,
      TenantMembershipStatus.REVOKED
    );
    if (!updated) {
      throw new PortalInviteNotFoundError("Portal invite not found");
    }

    logTenantPortalRevoked(updated);
    return updated;
  },
};

export { DuplicatePortalInviteError };
