import { beforeEach, describe, expect, test } from "bun:test";

import {
  duplicatePropertyMemberInviteError,
  PropertyMemberInviteErrorCode,
} from "@/errors/property-member-invite-errors";
import { PropertyInviteStatus, PropertyRole } from "@/packages/shared";
import { makeInvite, makeProperty, makePropertyMember, makeUser } from "@/test-fixtures/domain";
import {
  createPropertyMemberInviteServiceMocks,
  registerPropertyMemberInviteServiceModules,
  resetMocks,
} from "@/test-fixtures/mocks";

const sunsetProperty = makeProperty({
  address: "123 Main St",
  createdBy: "creator-1",
  name: "Sunset Apartments",
  unitCount: 2,
});
const inviterUser = makeUser({
  email: "inviter@example.com",
  id: "inviter-1",
  name: "Alex Operator",
});
const pendingInvite = makeInvite({ invitedBy: "inviter-1" });

const inviteMocks = createPropertyMemberInviteServiceMocks(pendingInvite);
registerPropertyMemberInviteServiceModules(inviteMocks);

const { propertyMemberInviteService } = await import("./property-member-invite-service");

describe("propertyMemberInviteService.previewInvite", () => {
  beforeEach(() => {
    resetMocks(
      inviteMocks.findByInviteToken,
      inviteMocks.expireInviteIfPastTtl,
      inviteMocks.findByIdProperty,
      inviteMocks.findByIdUser,
      inviteMocks.findByEmail
    );
  });

  test("returns preview for pending invite token", async () => {
    inviteMocks.findByInviteToken.mockResolvedValueOnce(pendingInvite);
    inviteMocks.expireInviteIfPastTtl.mockResolvedValueOnce(null);
    inviteMocks.findByIdProperty.mockResolvedValueOnce(sunsetProperty);
    inviteMocks.findByIdUser.mockResolvedValueOnce(inviterUser);
    inviteMocks.findByEmail.mockResolvedValueOnce(null);

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
    resetMocks(
      inviteMocks.findByIdProperty,
      inviteMocks.findByIdUser,
      inviteMocks.findByEmail,
      inviteMocks.findOneMember,
      inviteMocks.createInvite,
      inviteMocks.sendNewEmail,
      inviteMocks.sendExistingEmail,
      inviteMocks.notifyUser
    );

    inviteMocks.findByIdProperty.mockResolvedValue(sunsetProperty);
    inviteMocks.findByIdUser.mockResolvedValue(inviterUser);
    inviteMocks.createInvite.mockResolvedValue(pendingInvite);
    inviteMocks.sendNewEmail.mockResolvedValue(true);
    inviteMocks.sendExistingEmail.mockResolvedValue(true);
    inviteMocks.findOneMember.mockResolvedValue(null);
  });

  test("sends new-user invite for unknown email", async () => {
    inviteMocks.findByEmail.mockResolvedValue(null);

    const result = await propertyMemberInviteService.addMemberViaInvite({
      email: "new@example.com",
      invitedBy: "inviter-1",
      propertyId: "property-1",
      role: PropertyRole.MANAGER,
    });

    expect(result.type).toBe("invite_sent");
    expect(inviteMocks.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        status: PropertyInviteStatus.PENDING_INVITE,
      })
    );
    expect(inviteMocks.sendNewEmail).toHaveBeenCalled();
    expect(inviteMocks.sendExistingEmail).not.toHaveBeenCalled();
    expect(inviteMocks.findOneMember).not.toHaveBeenCalled();
    expect(inviteMocks.notifyUser).not.toHaveBeenCalled();
  });

  test("sends existing-user invite without adding member row", async () => {
    inviteMocks.findByEmail.mockResolvedValue(
      makeUser({ email: "existing@example.com", id: "existing-user-1" })
    );
    inviteMocks.createInvite.mockResolvedValue(
      makeInvite({
        email: "existing@example.com",
        invitedBy: "inviter-1",
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
    expect(inviteMocks.findOneMember).toHaveBeenCalledWith("property-1", "existing-user-1");
    expect(inviteMocks.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "existing@example.com",
        status: PropertyInviteStatus.PENDING_ACCEPTANCE,
      })
    );
    expect(inviteMocks.sendExistingEmail).toHaveBeenCalled();
    expect(inviteMocks.sendNewEmail).not.toHaveBeenCalled();
    expect(inviteMocks.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        contextResourceId: "invite-1",
        type: "property_member_invite_received",
        userId: "existing-user-1",
      })
    );
  });

  test("throws when user is already a member", async () => {
    inviteMocks.findByEmail.mockResolvedValue(
      makeUser({ email: "member@example.com", id: "member-user-1" })
    );
    inviteMocks.findOneMember.mockResolvedValue(
      makePropertyMember({
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "membership-1",
        propertyId: "property-1",
        role: PropertyRole.MANAGER,
        updatedAt: "2026-01-01T00:00:00.000Z",
        userId: "member-user-1",
      })
    );

    await expect(
      propertyMemberInviteService.addMemberViaInvite({
        email: "member@example.com",
        invitedBy: "inviter-1",
        propertyId: "property-1",
        role: PropertyRole.MANAGER,
      })
    ).rejects.toMatchObject({ code: PropertyMemberInviteErrorCode.ALREADY_MEMBER });

    expect(inviteMocks.createInvite).not.toHaveBeenCalled();
  });

  test("propagates duplicate pending invite errors", async () => {
    inviteMocks.findByEmail.mockResolvedValue(null);
    inviteMocks.createInvite.mockRejectedValueOnce(duplicatePropertyMemberInviteError());

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
