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
  PENDING_ACCEPTANCE: "pending_acceptance",
  PENDING_INVITE: "pending_invite",
  REVOKED: "revoked",
} as const;

export type TTenantMembershipStatus =
  (typeof TenantMembershipStatus)[keyof typeof TenantMembershipStatus];

export const TENANT_JWT_AUDIENCE = "tenant" as const;

export interface ITenantUser {
  createdAt: string;
  email: string;
  emailVerifiedAt: string | null;
  id: string;
  name: string;
  phone: string | null;
  updatedAt: string;
}

export interface ILeaseTenantMembership {
  acceptedAt: string | null;
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
  /** Zero-based indexes into `lease.secondaryTenants` to invite. */
  secondaryIndexes?: number[];
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
