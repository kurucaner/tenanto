import { beforeEach, describe, expect, mock, test } from "bun:test";

import { PropertyInviteStatus } from "@/packages/shared";
import { makeInvite } from "@/test-fixtures/domain";

const mockInfo = mock((_event: string, _context?: Record<string, unknown>) => undefined);

mock.module("./winston", () => ({
  WinstonLogger: {
    info: mockInfo,
  },
}));

const {
  buildPropertyMemberInviteLogContext,
  logPropertyMemberInviteAccepted,
  logPropertyMemberInviteDeclined,
  logPropertyMemberInviteInvited,
  logPropertyMemberInviteResent,
  logPropertyMemberInviteRevoked,
} = await import("./property-member-invite-observability");

describe("property-member-invite-observability", () => {
  beforeEach(() => {
    mockInfo.mockClear();
  });

  test("normalizes invite email in log context", () => {
    expect(
      buildPropertyMemberInviteLogContext(makeInvite({ email: "  Invitee@Example.COM " }))
    ).toEqual({
      inviteEmail: "invitee@example.com",
      inviteId: "invite-1",
      propertyId: "property-1",
      status: PropertyInviteStatus.PENDING_INVITE,
    });
  });

  test("emits stable event names for each lifecycle transition", () => {
    const invite = makeInvite({ email: "  Invitee@Example.COM " });

    logPropertyMemberInviteInvited(invite, { emailSent: true });
    logPropertyMemberInviteResent(invite, { emailSent: true });
    logPropertyMemberInviteRevoked(invite);
    logPropertyMemberInviteAccepted(invite);
    logPropertyMemberInviteDeclined(invite);

    expect(mockInfo.mock.calls.map((call) => call[0]) as unknown as string[]).toEqual([
      "property_member_invite.invited",
      "property_member_invite.resent",
      "property_member_invite.revoked",
      "property_member_invite.accepted",
      "property_member_invite.declined",
    ]);
  });
});
