import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { type TenantJwtPayload } from "@/auth/tenant-jwt";
import { leaseTenantMembershipsDb } from "@/db/lease-tenant-memberships";
import { propertiesDb } from "@/db/properties";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import { tenantUsersDb } from "@/db/tenant-users";
import { tenantMembershipNotFoundError } from "@/errors/lease-errors";
import {
  portalInviteInvalidStateError,
  portalInviteNotFoundError,
} from "@/errors/portal-invite-errors";
import {
  buildTenantInviteLeaseSummary,
  formatUnitLabel,
} from "@/lib/build-tenant-invite-lease-summary";
import type {
  ILeaseTenantMembership,
  ITenantAuthSessionResponse,
  ITenantLeaseDetailResponse,
  ITenantLeaseListItem,
  ITenantPendingInvite,
  ITenantUser,
  TTenantLeaseListStatus,
  TTenantMembershipStatus,
} from "@/packages/shared";
import {
  formatRentPeriodLabel,
  isWeeklyPeriodKey,
  JwtAudience,
  normalizeTenantEmail,
  requireMembershipInviteEmail,
  TenantLeaseListStatus,
  TenantMembershipStatus,
} from "@/packages/shared";
import { syncLeasePhoneToTenantUserOnAccept } from "@/services/sync-lease-phone-to-tenant-on-accept";
import { issueTenantSession } from "@/services/tenant-auth-service";

import { assertLeaseTenantReadAccess } from "./tenant-portal-access";
import { logTenantPortalAccepted, logTenantPortalDeclined } from "./tenant-portal-observability";

const ACCEPTABLE_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_INVITE,
  TenantMembershipStatus.PENDING_ACCEPTANCE,
]);

function assertMembershipMatchesTenant(
  membership: ILeaseTenantMembership,
  tenantUser: ITenantUser
): void {
  if (
    requireMembershipInviteEmail(membership.inviteEmail) !== normalizeTenantEmail(tenantUser.email)
  ) {
    throw portalInviteInvalidStateError("This invite was sent to a different email address");
  }

  if (membership.tenantUserId != null && membership.tenantUserId !== tenantUser.id) {
    throw portalInviteInvalidStateError("This invite belongs to another account");
  }
}

async function assertMembershipActionable(membership: ILeaseTenantMembership): Promise<void> {
  if (
    membership.status === TenantMembershipStatus.DECLINED ||
    membership.status === TenantMembershipStatus.EXPIRED
  ) {
    throw portalInviteInvalidStateError(
      "This invite is no longer available. Ask your property manager to resend."
    );
  }

  if (!ACCEPTABLE_STATUSES.has(membership.status)) {
    throw portalInviteInvalidStateError("This invite is no longer available");
  }

  const expired = await leaseTenantMembershipsDb.expireMembershipIfPastTtl(membership);
  if (expired) {
    throw portalInviteInvalidStateError("This invite has expired");
  }
}

async function acceptMembershipForTenant(
  membership: ILeaseTenantMembership,
  tenantUser: ITenantUser
): Promise<ILeaseTenantMembership> {
  await assertMembershipActionable(membership);
  assertMembershipMatchesTenant(membership, tenantUser);

  let current = membership;
  if (current.tenantUserId == null) {
    const linked = await leaseTenantMembershipsDb.linkTenantUser(current.id, tenantUser.id);
    if (!linked) {
      throw portalInviteNotFoundError("Portal invite not found");
    }
    current = linked;
  }

  const updated = await leaseTenantMembershipsDb.transitionStatus(
    current.id,
    TenantMembershipStatus.ACTIVE
  );
  if (!updated) {
    throw portalInviteNotFoundError("Portal invite not found");
  }
  logTenantPortalAccepted(updated);
  await syncLeasePhoneToTenantUserOnAccept(updated, tenantUser);
  return updated;
}

async function loadPendingInviteItem(
  membership: ILeaseTenantMembership
): Promise<ITenantPendingInvite | null> {
  const lease = await propertyLongStaysDb.findById(membership.leaseId);
  if (!lease) {
    return null;
  }

  const [property, unit] = await Promise.all([
    propertiesDb.findById(lease.propertyId),
    propertyUnitsDb.findById(lease.unitId),
  ]);
  if (!property || !unit) {
    return null;
  }

  const summary = buildTenantInviteLeaseSummary(membership, lease, property, unit);
  return {
    displayName: summary.displayName,
    expiresAt: membership.expiresAt,
    leaseId: summary.leaseId,
    membershipId: membership.id,
    propertyName: summary.propertyName,
    role: summary.role,
    unitLabel: summary.unitLabel,
  };
}

async function loadLeaseListItem(
  membership: ILeaseTenantMembership
): Promise<ITenantLeaseListItem | null> {
  const lease = await propertyLongStaysDb.findById(membership.leaseId);
  if (!lease) {
    return null;
  }

  const [property, unit] = await Promise.all([
    propertiesDb.findById(lease.propertyId),
    propertyUnitsDb.findById(lease.unitId),
  ]);
  if (!property || !unit) {
    return null;
  }

  return {
    leaseEndDate: lease.leaseEndDate,
    leaseId: lease.id,
    leaseStartDate: lease.leaseStartDate,
    propertyName: property.name,
    role: membership.role,
    status: membership.status,
    unitLabel: formatUnitLabel(unit),
  };
}

export const tenantPortalMembershipService = {
  async acceptInvite(
    membershipId: string,
    tenantUser: ITenantUser
  ): Promise<ILeaseTenantMembership> {
    const membership = await leaseTenantMembershipsDb.findById(membershipId);
    if (!membership) {
      throw tenantMembershipNotFoundError();
    }
    return acceptMembershipForTenant(membership, tenantUser);
  },

  async declineInvite(
    membershipId: string,
    tenantUser: ITenantUser
  ): Promise<ILeaseTenantMembership> {
    const membership = await leaseTenantMembershipsDb.findById(membershipId);
    if (!membership) {
      throw tenantMembershipNotFoundError();
    }

    await assertMembershipActionable(membership);
    assertMembershipMatchesTenant(membership, tenantUser);

    const updated = await leaseTenantMembershipsDb.transitionStatus(
      membership.id,
      TenantMembershipStatus.DECLINED
    );
    if (!updated) {
      throw tenantMembershipNotFoundError();
    }
    logTenantPortalDeclined(updated);
    return updated;
  },

  async getLeaseDetail(leaseId: string, tenantUserId: string): Promise<ITenantLeaseDetailResponse> {
    const membership = await assertLeaseTenantReadAccess(leaseId, tenantUserId);
    const lease = await propertyLongStaysDb.findById(leaseId);
    if (!lease) {
      throw tenantMembershipNotFoundError();
    }

    const [property, unit, rentScheduleMonths] = await Promise.all([
      propertiesDb.findById(lease.propertyId),
      propertyUnitsDb.findById(lease.unitId),
      membership.status === TenantMembershipStatus.ENDED
        ? Promise.resolve([])
        : propertyLongStaysDb.getRentSchedule(leaseId),
    ]);
    if (!property || !unit) {
      throw tenantMembershipNotFoundError();
    }

    return {
      displayName: membership.displayName,
      leaseEndDate: lease.leaseEndDate,
      leaseId: lease.id,
      leaseStartDate: lease.leaseStartDate,
      monthlyRent: lease.monthlyRent,
      propertyName: property.name,
      rentSchedule: rentScheduleMonths.map((item) => ({
        amount: item.expectedRent,
        dueDate: isWeeklyPeriodKey(item.month) ? item.month : `${item.month}-01`,
        periodLabel: formatRentPeriodLabel(item.month),
      })),
      role: membership.role,
      status: membership.status,
      unitLabel: formatUnitLabel(unit),
    };
  },

  async getProfile(tenantUserId: string): Promise<ITenantUser | null> {
    return tenantUsersDb.findById(tenantUserId);
  },

  async listLeases(
    tenantUserId: string,
    status: TTenantLeaseListStatus = TenantLeaseListStatus.ACTIVE
  ): Promise<ITenantLeaseListItem[]> {
    const memberships =
      status === TenantLeaseListStatus.ENDED
        ? await leaseTenantMembershipsDb.findEndedByTenantUserId(tenantUserId)
        : await leaseTenantMembershipsDb.findActiveByTenantUserId(tenantUserId);
    const items = await Promise.all(memberships.map((membership) => loadLeaseListItem(membership)));
    return items.filter((item): item is ITenantLeaseListItem => item != null);
  },

  async listPendingInvites(tenantUserId: string): Promise<ITenantPendingInvite[]> {
    const memberships =
      await leaseTenantMembershipsDb.findPendingAcceptanceByTenantUserId(tenantUserId);
    const items = await Promise.all(
      memberships.map((membership) => loadPendingInviteItem(membership))
    );
    return items.filter((item): item is ITenantPendingInvite => item != null);
  },

  async redeemInvite(token: string, tenantUser: ITenantUser): Promise<ILeaseTenantMembership> {
    const membership = await leaseTenantMembershipsDb.findByInviteToken(token);
    if (!membership) {
      throw portalInviteNotFoundError("Invalid or expired invite link");
    }
    return acceptMembershipForTenant(membership, tenantUser);
  },

  async resolveTenantUserForRedeem(
    server: FastifyInstance,
    input: {
      authorizationHeader?: string;
      email?: string;
      jwtVerify: () => Promise<TenantJwtPayload>;
      password?: string;
    }
  ): Promise<{ session?: ITenantAuthSessionResponse; user: ITenantUser } | null> {
    if (input.authorizationHeader?.startsWith("Bearer ")) {
      try {
        const payload = await input.jwtVerify();
        if (payload.aud === JwtAudience.TENANT && payload.tenantUserId) {
          const user = await tenantUsersDb.findById(payload.tenantUserId);
          if (user) {
            return { user };
          }
        }
      } catch {
        // Fall through to email/password when bearer token is invalid.
      }
    }

    const email = input.email?.trim();
    const password = input.password;
    if (!email || !password) {
      return null;
    }

    const userWithPassword = await tenantUsersDb.findByEmailWithPassword(email);
    if (!userWithPassword?.passwordHash) {
      return null;
    }

    const valid = await bcrypt.compare(password, userWithPassword.passwordHash);
    if (!valid) {
      return null;
    }

    const user = await tenantUsersDb.findByEmail(email);
    if (!user) {
      return null;
    }

    const session = await issueTenantSession(server, user);
    return { session, user };
  },
};
