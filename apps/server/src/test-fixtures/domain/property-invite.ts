import {
  type IPropertyInvite,
  type IPropertyMember,
  type IUser,
  PropertyInviteStatus,
  PropertyRole,
  UserType,
} from "@/packages/shared";

export function makePropertyInvite(overrides: Partial<IPropertyInvite> = {}): IPropertyInvite {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    email: "invitee@example.com",
    emailError: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "invite-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "owner-1",
    propertyId: "property-1",
    revokedAt: null,
    role: PropertyRole.MANAGER,
    status: PropertyInviteStatus.PENDING_INVITE,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export const makeInvite = makePropertyInvite;

export function makePlatformUser(overrides: Partial<IUser> = {}): IUser {
  return {
    appleId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "invitee@example.com",
    googleId: null,
    id: "user-1",
    name: "Invitee",
    onboardingCompletedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userType: UserType.USER,
    ...overrides,
  };
}

export const makeUser = makePlatformUser;

export function makePropertyMember(overrides: Partial<IPropertyMember> = {}): IPropertyMember {
  return {
    addedBy: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "member-1",
    propertyId: "property-1",
    role: PropertyRole.MANAGER,
    updatedAt: "2026-01-01T00:00:00.000Z",
    user: { email: "invitee@example.com", id: "user-1", name: "Invitee" },
    userId: "user-1",
    ...overrides,
  };
}

export const makeMember = makePropertyMember;
