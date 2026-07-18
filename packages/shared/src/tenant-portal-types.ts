export const TenantMembershipRole = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
} as const;

export type TTenantMembershipRole =
  (typeof TenantMembershipRole)[keyof typeof TenantMembershipRole];

export const TenantMembershipStatus = {
  ACTIVE: "active",
  DECLINED: "declined",
  ENDED: "ended",
  EXPIRED: "expired",
  LISTED: "listed",
  PENDING_ACCEPTANCE: "pending_acceptance",
  PENDING_INVITE: "pending_invite",
  REVOKED: "revoked",
} as const;

export type TTenantMembershipStatus =
  (typeof TenantMembershipStatus)[keyof typeof TenantMembershipStatus];

export interface ITenantUser {
  createdAt: string;
  email: string;
  emailVerifiedAt: string | null;
  id: string;
  name: string;
  phone: string | null;
  phoneVerifiedAt: string | null;
  updatedAt: string;
}

export interface ILeaseTenantMembership {
  acceptedAt: string | null;
  contactPhone: string | null;
  createdAt: string;
  declinedAt: string | null;
  displayName: string;
  endedAt: string | null;
  expiresAt: string;
  id: string;
  invitedAt: string;
  invitedBy: string;
  inviteEmail: string;
  leaseId: string;
  revokedAt: string | null;
  role: TTenantMembershipRole;
  status: TTenantMembershipStatus;
  tenantUserId: string | null;
  updatedAt: string;
}

export interface ITenantInviteLeaseSummary {
  displayName: string;
  leaseEndDate: string;
  leaseId: string;
  leaseStartDate: string;
  propertyName: string;
  role: TTenantMembershipRole;
  unitLabel: string;
}

export interface ITenantLeaseListItem {
  leaseEndDate: string;
  leaseId: string;
  leaseStartDate: string;
  propertyName: string;
  role: TTenantMembershipRole;
  status: TTenantMembershipStatus;
  unitLabel: string;
}

/** Query filter for `GET /tenant/me/leases` — active is the default. */
export const TenantLeaseListStatus = {
  ACTIVE: "active",
  ENDED: "ended",
} as const;

export type TTenantLeaseListStatus =
  (typeof TenantLeaseListStatus)[keyof typeof TenantLeaseListStatus];

export interface ITenantLeaseDetailResponse {
  displayName: string;
  leaseEndDate: string;
  leaseId: string;
  leaseStartDate: string;
  monthlyRent: number;
  propertyName: string;
  rentSchedule: readonly {
    amount: number;
    dueDate: string;
    periodLabel: string;
  }[];
  role: TTenantMembershipRole;
  status: TTenantMembershipStatus;
  unitLabel: string;
}

export interface ICreateLeasePortalInviteResponse {
  membership: ILeaseTenantMembership;
}

export interface ICreateLeasePortalInviteBody {
  /** When true, invite the lease primary tenant (`tenantEmail`). */
  invitePrimary?: boolean;
  /**
   * @deprecated Use `secondaryMembershipIds`. Removed in S5b.
   * Zero-based indexes into resolved secondary contacts (legacy one-release fallback).
   */
  secondaryIndexes?: number[];
  /** Secondary occupant membership ids to invite (listed → pending). */
  secondaryMembershipIds?: string[];
}

export interface ICreateLeasePortalInviteResult {
  emailError?: string;
  emailSent: boolean;
  membership: ILeaseTenantMembership;
}

export interface ICreateLeasePortalInvitesResponse {
  results: ICreateLeasePortalInviteResult[];
}

export interface ILeasePortalAccessResponse {
  memberships: ILeaseTenantMembership[];
}

export interface ITenantInvitePreviewResponse {
  hasExistingAccount: boolean;
  inviteEmail: string;
  membershipId: string;
  status: TTenantMembershipStatus;
  summary: ITenantInviteLeaseSummary;
}

export interface IResendLeasePortalInviteResponse {
  emailError?: string;
  emailSent: boolean;
  membership: ILeaseTenantMembership;
}

export interface IRevokeLeasePortalInviteResponse {
  membership: ILeaseTenantMembership;
}

export interface ITenantPendingInvite {
  displayName: string;
  expiresAt: string;
  leaseId: string;
  membershipId: string;
  propertyName: string;
  role: TTenantMembershipRole;
  unitLabel: string;
}

export interface ITenantAuthRegisterStartBody {
  email: string;
}

export interface ITenantAuthRegisterVerifyBody {
  email: string;
  name: string;
  otp: string;
  password: string;
}

export interface ITenantAuthLoginBody {
  email: string;
  password: string;
}

export interface ITenantAuthRefreshBody {
  refreshToken: string;
}

export interface ITenantAuthLogoutBody {
  refreshToken: string;
}

export interface ITenantAuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  user: ITenantUser;
}

export interface ITenantGoogleAuthBody {
  idToken: string;
}

export interface ITenantAppleAuthBody {
  identityToken: string;
  name?: string;
}

export interface ITenantPhoneAuthStartBody {
  phone: string;
}

export interface ITenantPhoneAuthVerifyBody {
  code: string;
  phone: string;
}

export interface ITenantPhoneBindStartBody {
  phone: string;
}

export interface ITenantPhoneBindVerifyBody {
  code: string;
  phone: string;
}

export interface ITenantMeResponse {
  user: ITenantUser;
}

export interface ITenantLeasesListResponse {
  leases: ITenantLeaseListItem[];
}

export interface ITenantPendingInvitesResponse {
  invites: ITenantPendingInvite[];
}

export interface ITenantMembershipActionResponse {
  membership: ILeaseTenantMembership;
}

/**
 * Response for `POST /tenant/me/leases/:leaseId/disconnect` (Enhancements Phase 1).
 * Membership transitions `active` → `revoked`; does not end the lease.
 */
export type TTenantDisconnectResponse = ITenantMembershipActionResponse;

export interface ITenantInviteRedeemBody {
  email?: string;
  password?: string;
  token: string;
}

export interface ITenantInviteRegisterBody {
  name: string;
  password: string;
  token: string;
}

export interface ITenantInviteRegisterGoogleBody {
  idToken: string;
  token: string;
}

export interface ITenantInviteRedeemResponse {
  membership: ILeaseTenantMembership;
  session?: ITenantAuthSessionResponse;
}
