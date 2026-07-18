import {
  type ILeaseSecondaryTenantContact,
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

export type TLeasePortalActingTarget =
  { kind: "invite-all" } | { kind: "primary" } | { kind: "secondary"; membershipId: string };

export type TLeasePortalStatusTone = "active" | "muted" | "neutral" | "pending";

export interface ILeasePortalRowState {
  actions: TLeasePortalRowAction[];
  membership: ILeaseTenantMembership | null;
  statusLabel: string;
  statusTone: TLeasePortalStatusTone;
}

export function isSameLeasePortalActingTarget(
  actingTarget: TLeasePortalActingTarget | null,
  rowTarget: TLeasePortalActingTarget
): boolean {
  if (!actingTarget || actingTarget.kind !== rowTarget.kind) {
    return false;
  }
  if (actingTarget.kind === "secondary" && rowTarget.kind === "secondary") {
    return actingTarget.membershipId === rowTarget.membershipId;
  }
  return true;
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
    return "Pending";
  }

  switch (membership.status) {
    case TenantMembershipStatus.ACTIVE:
      return "Active";
    case TenantMembershipStatus.DECLINED:
      return "Declined";
    case TenantMembershipStatus.ENDED:
      return "Ended";
    case TenantMembershipStatus.EXPIRED:
      return "Expired";
    case TenantMembershipStatus.LISTED:
      return "Not invited";
    case TenantMembershipStatus.REVOKED:
      return "Revoked";
    default:
      return membership.status;
  }
}

export function getLeasePortalStatusTone(statusLabel: string): TLeasePortalStatusTone {
  switch (statusLabel) {
    case "Active":
      return "active";
    case "Pending":
      return "pending";
    case "Not invited":
      return "neutral";
    default:
      return "muted";
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
  const statusTone = getLeasePortalStatusTone(statusLabel);
  const actions: TLeasePortalRowAction[] = [];

  if (!hasEmail) {
    return { actions, membership, statusLabel, statusTone };
  }

  if (
    !membership ||
    membership.status === TenantMembershipStatus.LISTED ||
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

  return { actions, membership, statusLabel, statusTone };
}

export function getLeasePortalInviteAllTargets(
  lease: IPropertyLongStay,
  memberships: readonly ILeaseTenantMembership[],
  secondaryContacts: readonly ILeaseSecondaryTenantContact[] = []
): {
  invitePrimary: boolean;
  secondaryMembershipIds: string[];
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

  const secondaryMembershipIds = secondaryContacts
    .map((contact) => {
      const rowMembership =
        (contact.membershipId
          ? memberships.find((membership) => membership.id === contact.membershipId)
          : null) ??
        findLeasePortalMembership(
          memberships,
          TenantMembershipRole.SECONDARY,
          contact.effectiveEmail
        );
      const rowState = getLeasePortalRowState(
        rowMembership,
        Boolean(contact.effectiveEmail?.trim())
      );
      if (!rowState.actions.includes("invite") || !contact.membershipId) {
        return null;
      }
      return contact.membershipId;
    })
    .filter((membershipId): membershipId is string => membershipId !== null);

  return {
    invitePrimary: primaryState.actions.includes("invite"),
    secondaryMembershipIds,
  };
}
