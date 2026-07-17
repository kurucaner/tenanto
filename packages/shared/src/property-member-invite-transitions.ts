import {
  PropertyInviteStatus,
  type IPropertyInvite,
  type TPropertyInviteStatus,
} from "./property-types";

export const TERMINAL_PROPERTY_MEMBER_INVITE_STATUSES = [
  PropertyInviteStatus.ACCEPTED,
  PropertyInviteStatus.DECLINED,
  PropertyInviteStatus.REVOKED,
  PropertyInviteStatus.EXPIRED,
  PropertyInviteStatus.EMAIL_FAILED,
] as const satisfies readonly TPropertyInviteStatus[];

export const PENDING_PROPERTY_MEMBER_INVITE_STATUSES = [
  PropertyInviteStatus.PENDING,
  PropertyInviteStatus.PENDING_INVITE,
  PropertyInviteStatus.PENDING_ACCEPTANCE,
] as const satisfies readonly TPropertyInviteStatus[];

const ALLOWED_TRANSITIONS: Readonly<
  Record<TPropertyInviteStatus, readonly TPropertyInviteStatus[]>
> = {
  [PropertyInviteStatus.ACCEPTED]: [],
  [PropertyInviteStatus.DECLINED]: [],
  [PropertyInviteStatus.EMAIL_FAILED]: [],
  [PropertyInviteStatus.EXPIRED]: [],
  [PropertyInviteStatus.PENDING]: [
    PropertyInviteStatus.ACCEPTED,
    PropertyInviteStatus.DECLINED,
    PropertyInviteStatus.EXPIRED,
    PropertyInviteStatus.REVOKED,
    PropertyInviteStatus.EMAIL_FAILED,
  ],
  [PropertyInviteStatus.PENDING_ACCEPTANCE]: [
    PropertyInviteStatus.ACCEPTED,
    PropertyInviteStatus.DECLINED,
    PropertyInviteStatus.EXPIRED,
    PropertyInviteStatus.REVOKED,
    PropertyInviteStatus.EMAIL_FAILED,
  ],
  [PropertyInviteStatus.PENDING_INVITE]: [
    PropertyInviteStatus.ACCEPTED,
    PropertyInviteStatus.DECLINED,
    PropertyInviteStatus.EXPIRED,
    PropertyInviteStatus.REVOKED,
    PropertyInviteStatus.EMAIL_FAILED,
  ],
  [PropertyInviteStatus.REVOKED]: [],
};

export function isPendingPropertyMemberInviteStatus(status: TPropertyInviteStatus): boolean {
  return (PENDING_PROPERTY_MEMBER_INVITE_STATUSES as readonly TPropertyInviteStatus[]).includes(
    status
  );
}

export function isTerminalPropertyMemberInviteStatus(status: TPropertyInviteStatus): boolean {
  return (TERMINAL_PROPERTY_MEMBER_INVITE_STATUSES as readonly TPropertyInviteStatus[]).includes(
    status
  );
}

export function canTransitionPropertyMemberInviteStatus(
  from: TPropertyInviteStatus,
  to: TPropertyInviteStatus
): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function normalizePropertyMemberInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getPropertyMemberInviteAdminPriority(status: TPropertyInviteStatus): number {
  if (isPendingPropertyMemberInviteStatus(status)) {
    return 0;
  }
  if (status === PropertyInviteStatus.EMAIL_FAILED) {
    return 1;
  }
  return 2;
}

function getPropertyMemberInviteSortTimestamp(invite: IPropertyInvite): number {
  return new Date(invite.invitedAt).getTime() || new Date(invite.createdAt).getTime();
}

function pickCanonicalPropertyMemberInvite(
  invites: readonly IPropertyInvite[]
): IPropertyInvite {
  return invites.reduce((best, current) => {
    const bestPriority = getPropertyMemberInviteAdminPriority(best.status);
    const currentPriority = getPropertyMemberInviteAdminPriority(current.status);

    if (currentPriority < bestPriority) {
      return current;
    }
    if (currentPriority > bestPriority) {
      return best;
    }

    return getPropertyMemberInviteSortTimestamp(current) > getPropertyMemberInviteSortTimestamp(best)
      ? current
      : best;
  });
}

export function pickCanonicalPropertyMemberInvitesForAdmin(
  invites: readonly IPropertyInvite[]
): IPropertyInvite[] {
  const byEmail = new Map<string, IPropertyInvite[]>();

  for (const invite of invites) {
    const key = normalizePropertyMemberInviteEmail(invite.email);
    const group = byEmail.get(key);
    if (group) {
      group.push(invite);
    } else {
      byEmail.set(key, [invite]);
    }
  }

  return [...byEmail.values()]
    .map(pickCanonicalPropertyMemberInvite)
    .sort(
      (left, right) =>
        getPropertyMemberInviteSortTimestamp(left) - getPropertyMemberInviteSortTimestamp(right)
    );
}
