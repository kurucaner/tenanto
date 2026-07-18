import { describe, expect, mock, test } from "bun:test";

import { PropertyInviteStatus, PropertyRole } from "@/packages/shared";
import { makeInvite, makeProperty, makeUser } from "@/test-fixtures/domain";

const mockNotifyUser = mock(() => Promise.resolve());

mock.module("@/services/user-notifications", () => ({
  notifyUser: mockNotifyUser,
}));

const { notifyPropertyMemberInviteReceived } =
  await import("@/services/property-member-invite-notifications");

describe("notifyPropertyMemberInviteReceived", () => {
  test("creates property_member_invite_received notification with invite id context", async () => {
    mockNotifyUser.mockClear();

    await notifyPropertyMemberInviteReceived({
      invite: makeInvite({
        invitedBy: "inviter-1",
        status: PropertyInviteStatus.PENDING_ACCEPTANCE,
      }),
      invitee: makeUser({ name: "Jamie Invitee" }),
      property: makeProperty({
        address: "123 Main St",
        createdBy: "creator-1",
        name: "Sunset Apartments",
        unitCount: 2,
      }),
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
