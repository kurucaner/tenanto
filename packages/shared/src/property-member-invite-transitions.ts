import {
  PropertyInviteStatus,
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
