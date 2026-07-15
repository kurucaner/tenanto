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
  TenantMembershipRole,
  TenantMembershipStatus,
  type TTenantMembershipRole,
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

import {
  logTenantPortalInvited,
  logTenantPortalResent,
  logTenantPortalRevoked,
} from "./tenant-portal-observability";

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
  const acceptUrl = buildPortalInviteAcceptUrl(rawToken);
  try {
    if (hasExistingAccount) {
      await sendTenantPortalInviteExistingEmail(membership.inviteEmail, {
        acceptUrl,
        displayName: summary.displayName,
        propertyName: summary.propertyName,
        unitLabel: summary.unitLabel,
      });
    } else {
      await sendTenantPortalInviteNewEmail(membership.inviteEmail, {
        acceptUrl,
        displayName: summary.displayName,
        propertyName: summary.propertyName,
        unitLabel: summary.unitLabel,
      });
    }
    return { emailSent: true };
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

function resolveSecondaryInviteTarget(
  lease: IPropertyLongStay,
  index: number
): { displayName: string; email: string } {
  const tenant = lease.secondaryTenants[index];
  if (!tenant) {
    throw new PortalInviteTargetError(`secondaryIndexes contains invalid index ${index}`);
  }
  const email = tenant.email?.trim() ?? "";
  if (!email || !isValidTenantEmail(email)) {
    throw new PortalInviteTargetError(`Secondary tenant at index ${index} has no valid email`);
  }
  return {
    displayName: tenant.name.trim(),
    email: normalizeTenantEmail(email),
  };
}

export const tenantPortalInviteService = {
  async createInvites(input: {
    invitedBy: string;
    invitePrimary?: boolean;
    leaseId: string;
    propertyId: string;
    secondaryIndexes?: number[];
  }): Promise<ICreateLeasePortalInviteResult[]> {
    const context = await loadLeaseContext(input.leaseId, input.propertyId);
    if (!context) {
      throw new PortalInviteNotFoundError("Long stay not found");
    }

    const invitePrimary = input.invitePrimary === true;
    const secondaryIndexes = input.secondaryIndexes ?? [];
    if (!invitePrimary && secondaryIndexes.length === 0) {
      throw new PortalInviteTargetError(
        "At least one of invitePrimary or secondaryIndexes is required"
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

    for (const index of secondaryIndexes) {
      const secondary = resolveSecondaryInviteTarget(context.lease, index);
      results.push(
        await createAndSendInvite({
          displayName: secondary.displayName,
          invitedBy: input.invitedBy,
          inviteEmail: secondary.email,
          leaseId: input.leaseId,
          propertyId: input.propertyId,
          role: TenantMembershipRole.SECONDARY,
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
    const inviteTokenHash = hashPortalInviteToken(token);
    const membership = await leaseTenantMembershipsDb.findByTokenHash(inviteTokenHash);
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

    const hasExistingAccount = (await tenantUsersDb.findByEmail(membership.inviteEmail)) != null;

    return {
      hasExistingAccount,
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
    const hasExistingAccount =
      updated.status === TenantMembershipStatus.PENDING_ACCEPTANCE ||
      (await tenantUsersDb.findByEmail(updated.inviteEmail)) != null;
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
