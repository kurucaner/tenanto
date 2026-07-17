import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyInvite } from "@/packages/shared";
import { PropertyInviteStatus, PropertyRole } from "@/packages/shared";

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

function makeInvite(overrides: Partial<IPropertyInvite> = {}): IPropertyInvite {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    email: "  Invitee@Example.COM ",
    emailError: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "invite-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    propertyId: "property-1",
    revokedAt: null,
    role: PropertyRole.MANAGER,
    status: PropertyInviteStatus.PENDING_INVITE,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("property-member-invite-observability", () => {
  beforeEach(() => {
    mockInfo.mockClear();
  });

  test("normalizes invite email in log context", () => {
    expect(buildPropertyMemberInviteLogContext(makeInvite())).toEqual({
      inviteEmail: "invitee@example.com",
      inviteId: "invite-1",
      propertyId: "property-1",
      status: PropertyInviteStatus.PENDING_INVITE,
    });
  });

  test("emits stable event names for each lifecycle transition", () => {
    const invite = makeInvite();

    logPropertyMemberInviteInvited(invite, { emailSent: true });
    logPropertyMemberInviteResent(invite, { emailSent: true });
    logPropertyMemberInviteRevoked(invite);
    logPropertyMemberInviteAccepted(invite);
    logPropertyMemberInviteDeclined(invite);

    expect(mockInfo.mock.calls.map((call) => call[0])).toEqual([
      "property_member_invite.invited",
      "property_member_invite.resent",
      "property_member_invite.revoked",
      "property_member_invite.accepted",
      "property_member_invite.declined",
    ]);
  });
});
