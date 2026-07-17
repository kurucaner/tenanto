import { describe, expect, mock, test } from "bun:test";

import type { IProperty, IPropertyInvite, IUser } from "@/packages/shared";
import { PropertyInviteStatus, PropertyRole, UserType } from "@/packages/shared";

const mockNotifyUser = mock(() => Promise.resolve());

mock.module("@/services/user-notifications", () => ({
  notifyUser: mockNotifyUser,
}));

const { notifyPropertyMemberInviteReceived } =
  await import("@/services/property-member-invite-notifications");

function makeProperty(): IProperty {
  return {
    address: "123 Main St",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "creator-1",
    favoritedAt: null,
    id: "property-1",
    isFavorite: false,
    legalName: null,
    memberCount: 1,
    name: "Sunset Apartments",
    phoneNumber: null,
    unitCount: 2,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeInvite(): IPropertyInvite {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    email: "invitee@example.com",
    emailError: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "invite-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "inviter-1",
    propertyId: "property-1",
    revokedAt: null,
    role: PropertyRole.MANAGER,
    status: PropertyInviteStatus.PENDING_ACCEPTANCE,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeUser(): IUser {
  return {
    appleId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "invitee@example.com",
    googleId: null,
    id: "user-1",
    name: "Jamie Invitee",
    onboardingCompletedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userType: UserType.USER,
  };
}

describe("notifyPropertyMemberInviteReceived", () => {
  test("creates property_member_invite_received notification with invite id context", async () => {
    mockNotifyUser.mockClear();

    await notifyPropertyMemberInviteReceived({
      invite: makeInvite(),
      invitee: makeUser(),
      property: makeProperty(),
    });

    expect(mockNotifyUser).toHaveBeenCalledWith({
      body: "You've been invited as Manager. Accept to join this property team.",
      contextResourceId: "invite-1",
      resourceId: "property-1",
      resourceType: "property",
      title: "Invitation to Sunset Apartments",
      type: "property_member_invite_received",
      userId: "user-1",
    });
  });
});
