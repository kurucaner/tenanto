import {
  type ILeaseTenantMembership,
  type IPropertyLongStay,
  normalizeTenantEmail,
  TenantMembershipRole,
  TenantMembershipStatus,
  TERMINAL_TENANT_MEMBERSHIP_STATUSES,
  type TTenantMembershipRole,
  type TTenantMembershipStatus,
} from "@/packages/shared";

export type TLeasePortalRowAction = "invite" | "resend" | "revoke";

export interface ILeasePortalRowState {
  actions: TLeasePortalRowAction[];
  membership: ILeaseTenantMembership | null;
  statusLabel: string;
}

const PENDING_STATUSES = new Set<TTenantMembershipStatus>([
  TenantMembershipStatus.PENDING_INVITE,
  TenantMembershipStatus.PENDING_ACCEPTANCE,
]);

function isTerminalStatus(status: TTenantMembershipStatus): boolean {
  return (TERMINAL_TENANT_MEMBERSHIP_STATUSES as readonly TTenantMembershipStatus[]).includes(
    status
  );
}

export function formatLeasePortalAdminStatus(membership: ILeaseTenantMembership | null): string {
  if (!membership) {
    return "Not invited";
  }

  if (PENDING_STATUSES.has(membership.status)) {
    return "Invite pending";
  }

  switch (membership.status) {
    case TenantMembershipStatus.ACTIVE:
      return "Active";
    case TenantMembershipStatus.DECLINED:
      return "Declined";
    case TenantMembershipStatus.REVOKED:
      return "Revoked";
    case TenantMembershipStatus.ENDED:
      return "Ended";
    case TenantMembershipStatus.EXPIRED:
      return "Expired";
    default:
      return membership.status;
  }
}

export function findLeasePortalMembership(
  memberships: readonly ILeaseTenantMembership[],
  role: TTenantMembershipRole,
  email: string | null | undefined
): ILeaseTenantMembership | null {
  if (!email?.trim()) {
    return null;
  }

  const normalizedEmail = normalizeTenantEmail(email.trim());
  const matches = memberships.filter(
    (membership) =>
      membership.role === role && normalizeTenantEmail(membership.inviteEmail) === normalizedEmail
  );
  if (matches.length === 0) {
    return null;
  }

  const activeMembership = matches.find((membership) => !isTerminalStatus(membership.status));
  return activeMembership ?? matches[0] ?? null;
}

export function getLeasePortalRowState(
  membership: ILeaseTenantMembership | null,
  hasEmail: boolean
): ILeasePortalRowState {
  const statusLabel = formatLeasePortalAdminStatus(membership);
  const actions: TLeasePortalRowAction[] = [];

  if (!hasEmail) {
    return { actions, membership, statusLabel };
  }

  if (
    !membership ||
    membership.status === TenantMembershipStatus.EXPIRED ||
    isTerminalStatus(membership.status)
  ) {
    actions.push("invite");
  }

  if (membership && PENDING_STATUSES.has(membership.status)) {
    actions.push("resend");
  }

  if (membership?.status === TenantMembershipStatus.ACTIVE) {
    actions.push("revoke");
  }

  return { actions, membership, statusLabel };
}

export function getLeasePortalInviteAllTargets(
  lease: IPropertyLongStay,
  memberships: readonly ILeaseTenantMembership[]
): {
  invitePrimary: boolean;
  secondaryIndexes: number[];
} {
  const primaryMembership = findLeasePortalMembership(
    memberships,
    TenantMembershipRole.PRIMARY,
    lease.tenantEmail
  );
  const primaryState = getLeasePortalRowState(
    primaryMembership,
    Boolean(lease.tenantEmail?.trim())
  );

  const secondaryIndexes = lease.secondaryTenants
    .map((tenant, index) => {
      const rowMembership = findLeasePortalMembership(
        memberships,
        TenantMembershipRole.SECONDARY,
        tenant.email
      );
      const rowState = getLeasePortalRowState(rowMembership, Boolean(tenant.email?.trim()));
      return rowState.actions.includes("invite") ? index : null;
    })
    .filter((index): index is number => index !== null);

  return {
    invitePrimary: primaryState.actions.includes("invite"),
    secondaryIndexes,
  };
}
