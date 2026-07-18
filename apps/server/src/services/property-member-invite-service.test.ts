import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IProperty, IPropertyInvite, IPropertyMember, IUser } from "@/packages/shared";
import { PropertyInviteStatus, PropertyRole, UserType } from "@/packages/shared";
import {
  duplicatePropertyMemberInviteError,
  PropertyMemberInviteErrorCode,
} from "@/errors/property-member-invite-errors";

const mockFindByIdProperty = mock(() => Promise.resolve(null as IProperty | null));
const mockFindByEmail = mock(() => Promise.resolve(null as IUser | null));
const mockFindByIdUser = mock(() => Promise.resolve(null as IUser | null));
const mockFindByInviteToken = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockExpireInviteIfPastTtl = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockFindOneMember = mock(() => Promise.resolve(null as IPropertyMember | null));
const mockCreateInvite = mock(() => Promise.resolve(makeInvite()));
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

function makeUser(overrides?: Partial<IUser>): IUser {
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
    ...overrides,
  };
}

function makeInvite(overrides?: Partial<IPropertyInvite>): IPropertyInvite {
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
    ...overrides,
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

mock.module("@/db/property-members", () => ({
  propertyMembersDb: {
    findOne: mockFindOneMember,
  },
}));

mock.module("@/db/property-invites", () => ({
  propertyInvitesDb: {
    create: mockCreateInvite,
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

const mockNotifyUser = mock(() => Promise.resolve());

mock.module("@/services/user-notifications", () => ({
  notifyUser: mockNotifyUser,
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

describe("propertyMemberInviteService.addMemberViaInvite", () => {
  beforeEach(() => {
    mockFindByIdProperty.mockReset();
    mockFindByIdUser.mockReset();
    mockFindByEmail.mockReset();
    mockFindOneMember.mockReset();
    mockCreateInvite.mockReset();
    mockSendNewEmail.mockReset();
    mockSendExistingEmail.mockReset();
    mockNotifyUser.mockReset();

    mockFindByIdProperty.mockResolvedValue(makeProperty());
    mockFindByIdUser.mockResolvedValue(makeUser());
    mockCreateInvite.mockResolvedValue(makeInvite());
    mockSendNewEmail.mockResolvedValue(true);
    mockSendExistingEmail.mockResolvedValue(true);
    mockFindOneMember.mockResolvedValue(null);
  });

  test("sends new-user invite for unknown email", async () => {
    mockFindByEmail.mockResolvedValue(null);

    const result = await propertyMemberInviteService.addMemberViaInvite({
      email: "new@example.com",
      invitedBy: "inviter-1",
      propertyId: "property-1",
      role: PropertyRole.MANAGER,
    });

    expect(result.type).toBe("invite_sent");
    expect(mockCreateInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        status: PropertyInviteStatus.PENDING_INVITE,
      })
    );
    expect(mockSendNewEmail).toHaveBeenCalled();
    expect(mockSendExistingEmail).not.toHaveBeenCalled();
    expect(mockFindOneMember).not.toHaveBeenCalled();
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  test("sends existing-user invite without adding member row", async () => {
    mockFindByEmail.mockResolvedValue(
      makeUser({ email: "existing@example.com", id: "existing-user-1" })
    );
    mockCreateInvite.mockResolvedValue(
      makeInvite({
        email: "existing@example.com",
        status: PropertyInviteStatus.PENDING_ACCEPTANCE,
      })
    );

    const result = await propertyMemberInviteService.addMemberViaInvite({
      email: "existing@example.com",
      invitedBy: "inviter-1",
      propertyId: "property-1",
      role: PropertyRole.ACCOUNTANT,
    });

    expect(result.type).toBe("invite_sent");
    expect(mockFindOneMember).toHaveBeenCalledWith("property-1", "existing-user-1");
    expect(mockCreateInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "existing@example.com",
        status: PropertyInviteStatus.PENDING_ACCEPTANCE,
      })
    );
    expect(mockSendExistingEmail).toHaveBeenCalled();
    expect(mockSendNewEmail).not.toHaveBeenCalled();
    expect(mockNotifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        contextResourceId: "invite-1",
        type: "property_member_invite_received",
        userId: "existing-user-1",
      })
    );
  });

  test("throws when user is already a member", async () => {
    mockFindByEmail.mockResolvedValue(
      makeUser({ email: "member@example.com", id: "member-user-1" })
    );
    mockFindOneMember.mockResolvedValue({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "membership-1",
      propertyId: "property-1",
      role: PropertyRole.MANAGER,
      updatedAt: "2026-01-01T00:00:00.000Z",
      userId: "member-user-1",
    });

    await expect(
      propertyMemberInviteService.addMemberViaInvite({
        email: "member@example.com",
        invitedBy: "inviter-1",
        propertyId: "property-1",
        role: PropertyRole.MANAGER,
      })
    ).rejects.toMatchObject({ code: PropertyMemberInviteErrorCode.ALREADY_MEMBER });

    expect(mockCreateInvite).not.toHaveBeenCalled();
  });

  test("propagates duplicate pending invite errors", async () => {
    mockFindByEmail.mockResolvedValue(null);
    mockCreateInvite.mockRejectedValueOnce(duplicatePropertyMemberInviteError());

    await expect(
      propertyMemberInviteService.addMemberViaInvite({
        email: "new@example.com",
        invitedBy: "inviter-1",
        propertyId: "property-1",
        role: PropertyRole.MANAGER,
      })
    ).rejects.toMatchObject({ code: PropertyMemberInviteErrorCode.DUPLICATE });
  });
});
