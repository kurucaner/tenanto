import { TenantMembershipStatus, type TTenantMembershipStatus } from "./tenant-portal-types";

export const TERMINAL_TENANT_MEMBERSHIP_STATUSES = [
  TenantMembershipStatus.DECLINED,
  TenantMembershipStatus.REVOKED,
  TenantMembershipStatus.ENDED,
  TenantMembershipStatus.EXPIRED,
] as const satisfies readonly TTenantMembershipStatus[];

const ALLOWED_TRANSITIONS: Readonly<
  Record<TTenantMembershipStatus, readonly TTenantMembershipStatus[]>
> = {
  [TenantMembershipStatus.ACTIVE]: [TenantMembershipStatus.REVOKED, TenantMembershipStatus.ENDED],
  [TenantMembershipStatus.DECLINED]: [],
  [TenantMembershipStatus.ENDED]: [],
  [TenantMembershipStatus.EXPIRED]: [],
  [TenantMembershipStatus.PENDING_ACCEPTANCE]: [
    TenantMembershipStatus.ACTIVE,
    TenantMembershipStatus.DECLINED,
    TenantMembershipStatus.EXPIRED,
    TenantMembershipStatus.REVOKED,
    TenantMembershipStatus.ENDED,
  ],
  [TenantMembershipStatus.PENDING_INVITE]: [
    TenantMembershipStatus.ACTIVE,
    TenantMembershipStatus.DECLINED,
    TenantMembershipStatus.EXPIRED,
    TenantMembershipStatus.REVOKED,
    TenantMembershipStatus.ENDED,
  ],
  [TenantMembershipStatus.REVOKED]: [],
};

export function isTerminalTenantMembershipStatus(status: TTenantMembershipStatus): boolean {
  return (TERMINAL_TENANT_MEMBERSHIP_STATUSES as readonly TTenantMembershipStatus[]).includes(
    status
  );
}

export function canTransitionTenantMembershipStatus(
  from: TTenantMembershipStatus,
  to: TTenantMembershipStatus
): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}
