import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyInvite, IPropertyMember, IUser } from "@/packages/shared";
import { PropertyInviteStatus, PropertyRole, UserType } from "@/packages/shared";

const mockFindByIdInvite = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockFindByInviteToken = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockFindPendingByEmail = mock(() => Promise.resolve([] as IPropertyInvite[]));
const mockFindOneMember = mock(() => Promise.resolve(null as IPropertyMember | null));
const mockAddMember = mock(() => Promise.resolve(null as IPropertyMember | null));
const mockTransitionStatus = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockExpireInviteIfPastTtl = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockFindByIdProperty = mock(() => Promise.resolve(null));

function makeInvite(overrides: Partial<IPropertyInvite> = {}): IPropertyInvite {
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

function makeUser(): IUser {
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
  };
}

function makeMember(): IPropertyMember {
  return {
    addedBy: "owner-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "member-1",
    propertyId: "property-1",
    role: PropertyRole.MANAGER,
    updatedAt: "2026-01-01T00:00:00.000Z",
    user: { email: "invitee@example.com", id: "user-1", name: "Invitee" },
    userId: "user-1",
  };
}

mock.module("@/db/property-invites", () => ({
  propertyInvitesDb: {
    expireInviteIfPastTtl: mockExpireInviteIfPastTtl,
    findById: mockFindByIdInvite,
    findByInviteToken: mockFindByInviteToken,
    findPendingByEmail: mockFindPendingByEmail,
    transitionStatus: mockTransitionStatus,
  },
}));

mock.module("@/db/property-members", () => ({
  propertyMembersDb: {
    add: mockAddMember,
    findOne: mockFindOneMember,
  },
}));

mock.module("@/db/properties", () => ({
  propertiesDb: {
    findById: mockFindByIdProperty,
  },
}));

mock.module("@/services/user-notifications", () => ({
  notifyUser: mock(() => Promise.resolve()),
}));

const { propertyMemberInviteActionService } =
  await import("@/services/property-member-invite-action-service");

describe("propertyMemberInviteActionService.redeemInvite", () => {
  beforeEach(() => {
    mockFindByInviteToken.mockReset();
    mockFindOneMember.mockReset();
    mockAddMember.mockReset();
    mockTransitionStatus.mockReset();
    mockExpireInviteIfPastTtl.mockReset();
    mockFindByIdProperty.mockReset();
    mockFindOneMember.mockResolvedValue(null);
    mockExpireInviteIfPastTtl.mockResolvedValue(null);
    mockFindByIdProperty.mockResolvedValue({
      address: "123 Main St",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "owner-1",
      favoritedAt: null,
      id: "property-1",
      isFavorite: false,
      legalName: null,
      memberCount: 1,
      name: "Sunset Apartments",
      phoneNumber: null,
      unitCount: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("adds member and marks invite accepted", async () => {
    const invite = makeInvite();
    const member = makeMember();
    mockFindByInviteToken.mockResolvedValueOnce(invite);
    mockAddMember.mockResolvedValueOnce(member);
    mockTransitionStatus.mockResolvedValueOnce({
      ...invite,
      status: PropertyInviteStatus.ACCEPTED,
    });

    const result = await propertyMemberInviteActionService.redeemInvite("token-abc", makeUser());

    expect(result.member.id).toBe("member-1");
    expect(mockTransitionStatus).toHaveBeenCalledWith("invite-1", PropertyInviteStatus.ACCEPTED);
  });

  test("rejects invite sent to a different email", async () => {
    mockFindByInviteToken.mockResolvedValueOnce(makeInvite({ email: "other@example.com" }));

    await expect(
      propertyMemberInviteActionService.redeemInvite("token-abc", makeUser())
    ).rejects.toThrow("This invite was sent to a different email address");
  });
});

describe("propertyMemberInviteActionService.declineInvite", () => {
  beforeEach(() => {
    mockFindByIdInvite.mockReset();
    mockTransitionStatus.mockReset();
    mockExpireInviteIfPastTtl.mockReset();
    mockExpireInviteIfPastTtl.mockResolvedValue(null);
  });

  test("declines pending invite for matching user", async () => {
    const invite = makeInvite();
    mockFindByIdInvite.mockResolvedValueOnce(invite);
    mockTransitionStatus.mockResolvedValueOnce({
      ...invite,
      status: PropertyInviteStatus.DECLINED,
    });

    const result = await propertyMemberInviteActionService.declineInvite("invite-1", makeUser());

    expect(result.status).toBe(PropertyInviteStatus.DECLINED);
  });
});
