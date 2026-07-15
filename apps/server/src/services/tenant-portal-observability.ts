import type { ILeaseTenantMembership } from "@/packages/shared";
import { normalizeTenantEmail } from "@/packages/shared";

import { WinstonLogger } from "./winston";

export interface ITenantPortalMembershipLogContext {
  inviteEmail: string;
  leaseId: string;
  membershipId: string;
}

export function buildTenantPortalMembershipLogContext(
  membership: Pick<ILeaseTenantMembership, "id" | "inviteEmail" | "leaseId">
): ITenantPortalMembershipLogContext {
  return {
    inviteEmail: normalizeTenantEmail(membership.inviteEmail),
    leaseId: membership.leaseId,
    membershipId: membership.id,
  };
}

export function logTenantPortalInvited(membership: ILeaseTenantMembership): void {
  WinstonLogger.info("tenant_portal.invited", buildTenantPortalMembershipLogContext(membership));
}

export function logTenantPortalResent(membership: ILeaseTenantMembership): void {
  WinstonLogger.info("tenant_portal.resent", buildTenantPortalMembershipLogContext(membership));
}

export function logTenantPortalRevoked(membership: ILeaseTenantMembership): void {
  WinstonLogger.info("tenant_portal.revoked", buildTenantPortalMembershipLogContext(membership));
}

export function logTenantPortalAccepted(membership: ILeaseTenantMembership): void {
  WinstonLogger.info("tenant_portal.accepted", buildTenantPortalMembershipLogContext(membership));
}

export function logTenantPortalDeclined(membership: ILeaseTenantMembership): void {
  WinstonLogger.info("tenant_portal.declined", buildTenantPortalMembershipLogContext(membership));
}

export function logTenantPortalEnded(membership: ILeaseTenantMembership): void {
  WinstonLogger.info("tenant_portal.ended", buildTenantPortalMembershipLogContext(membership));
}

export function logTenantPortalMembershipsEnded(
  memberships: readonly ILeaseTenantMembership[]
): void {
  for (const membership of memberships) {
    logTenantPortalEnded(membership);
  }
}
