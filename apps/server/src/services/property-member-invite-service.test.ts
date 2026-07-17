import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IProperty, IPropertyInvite, IUser } from "@/packages/shared";
import { PropertyInviteStatus, PropertyRole, UserType } from "@/packages/shared";

const mockFindByIdProperty = mock(() => Promise.resolve(null as IProperty | null));
const mockFindByEmail = mock(() => Promise.resolve(null as IUser | null));
const mockFindByIdUser = mock(() => Promise.resolve(null as IUser | null));
const mockFindByInviteToken = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockExpireInviteIfPastTtl = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockSendNewEmail = mock(() => Promise.resolve(true));
const mockSendExistingEmail = mock(() => Promise.resolve(true));

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

function makeUser(): IUser {
  return {
    appleId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "inviter@example.com",
    googleId: null,
    id: "inviter-1",
    name: "Alex Operator",
    onboardingCompletedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userType: UserType.USER,
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
    status: PropertyInviteStatus.PENDING_INVITE,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

mock.module("@/db/properties", () => ({
  propertiesDb: { findById: mockFindByIdProperty },
}));

mock.module("@/db/users", () => ({
  userDb: {
    findByEmail: mockFindByEmail,
    findById: mockFindByIdUser,
  },
}));

mock.module("@/db/property-invites", () => ({
  DuplicatePropertyMemberInviteError: class DuplicatePropertyMemberInviteError extends Error {},
  propertyInvitesDb: {
    create: mock(() => Promise.resolve(makeInvite())),
    expireInviteIfPastTtl: mockExpireInviteIfPastTtl,
    findById: mock(() => Promise.resolve(makeInvite())),
    findByInviteToken: mockFindByInviteToken,
    transitionStatus: mock(() =>
      Promise.resolve({ ...makeInvite(), status: PropertyInviteStatus.REVOKED })
    ),
    updateInviteToken: mock(() => Promise.resolve(makeInvite())),
    updateStatus: mock(() => Promise.resolve(makeInvite())),
  },
}));

mock.module("@/ses/transactional-emails", () => ({
  sendPropertyMemberInviteExistingEmail: mockSendExistingEmail,
  sendPropertyMemberInviteNewEmail: mockSendNewEmail,
}));

const { propertyMemberInviteService } = await import("@/services/property-member-invite-service");

describe("propertyMemberInviteService.previewInvite", () => {
  beforeEach(() => {
    mockFindByInviteToken.mockReset();
    mockExpireInviteIfPastTtl.mockReset();
    mockFindByIdProperty.mockReset();
    mockFindByIdUser.mockReset();
    mockFindByEmail.mockReset();
  });

  test("returns preview for pending invite token", async () => {
    mockFindByInviteToken.mockResolvedValueOnce(makeInvite());
    mockExpireInviteIfPastTtl.mockResolvedValueOnce(null);
    mockFindByIdProperty.mockResolvedValueOnce(makeProperty());
    mockFindByIdUser.mockResolvedValueOnce(makeUser());
    mockFindByEmail.mockResolvedValueOnce(null);

    const preview = await propertyMemberInviteService.previewInvite("token-abc");

    expect(preview.inviteEmail).toBe("invitee@example.com");
    expect(preview.summary.propertyName).toBe("Sunset Apartments");
    expect(preview.summary.roleLabel).toBe("Manager");
    expect(preview.hasExistingAccount).toBe(false);
  });
});

describe("propertyMemberInviteService.revokeInvite", () => {
  test("revokes a pending invite", async () => {
    const result = await propertyMemberInviteService.revokeInvite({
      inviteId: "invite-1",
      propertyId: "property-1",
    });

    expect(result.invite.status).toBe(PropertyInviteStatus.REVOKED);
  });
});
