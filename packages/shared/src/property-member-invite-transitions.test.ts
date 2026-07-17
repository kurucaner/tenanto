import { describe, expect, test } from "bun:test";

import {
  canTransitionPropertyMemberInviteStatus,
  isPendingPropertyMemberInviteStatus,
  isTerminalPropertyMemberInviteStatus,
  pickCanonicalPropertyMemberInvitesForAdmin,
} from "./property-member-invite-transitions";
import { PropertyInviteStatus, PropertyRole, type IPropertyInvite } from "./property-types";

describe("property member invite transitions", () => {
  test("pending_invite can become accepted or declined", () => {
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_INVITE,
        PropertyInviteStatus.ACCEPTED
      )
    ).toBe(true);
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_INVITE,
        PropertyInviteStatus.DECLINED
      )
    ).toBe(true);
  });

  test("pending_acceptance can become accepted or declined", () => {
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_ACCEPTANCE,
        PropertyInviteStatus.ACCEPTED
      )
    ).toBe(true);
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_ACCEPTANCE,
        PropertyInviteStatus.DECLINED
      )
    ).toBe(true);
  });

  test("legacy pending is treated as pending", () => {
    expect(isPendingPropertyMemberInviteStatus(PropertyInviteStatus.PENDING)).toBe(true);
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING,
        PropertyInviteStatus.EXPIRED
      )
    ).toBe(true);
  });

  test("terminal statuses cannot transition", () => {
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.DECLINED,
        PropertyInviteStatus.ACCEPTED
      )
    ).toBe(false);
    expect(isTerminalPropertyMemberInviteStatus(PropertyInviteStatus.EXPIRED)).toBe(true);
    expect(isTerminalPropertyMemberInviteStatus(PropertyInviteStatus.PENDING_INVITE)).toBe(false);
  });

  test("same-status transition is rejected", () => {
    expect(
      canTransitionPropertyMemberInviteStatus(
        PropertyInviteStatus.PENDING_INVITE,
        PropertyInviteStatus.PENDING_INVITE
      )
    ).toBe(false);
  });
});

function makeInvite(
  overrides: Partial<IPropertyInvite> & Pick<IPropertyInvite, "email" | "id" | "status">
): IPropertyInvite {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    emailError: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    propertyId: "property-1",
    revokedAt: null,
    role: PropertyRole.MANAGER,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("pickCanonicalPropertyMemberInvitesForAdmin", () => {
  test("prefers pending over revoked rows for the same email", () => {
    const result = pickCanonicalPropertyMemberInvitesForAdmin([
      makeInvite({
        id: "revoked-1",
        email: "invitee@example.com",
        invitedAt: "2026-01-01T00:00:00.000Z",
        status: PropertyInviteStatus.REVOKED,
      }),
      makeInvite({
        id: "revoked-2",
        email: "invitee@example.com",
        invitedAt: "2026-01-02T00:00:00.000Z",
        status: PropertyInviteStatus.REVOKED,
      }),
      makeInvite({
        id: "pending-1",
        email: "invitee@example.com",
        invitedAt: "2026-01-03T00:00:00.000Z",
        status: PropertyInviteStatus.PENDING_INVITE,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("pending-1");
  });

  test("returns newest revoked when no pending invite exists", () => {
    const result = pickCanonicalPropertyMemberInvitesForAdmin([
      makeInvite({
        id: "revoked-1",
        email: "invitee@example.com",
        invitedAt: "2026-01-01T00:00:00.000Z",
        status: PropertyInviteStatus.REVOKED,
      }),
      makeInvite({
        id: "revoked-2",
        email: "invitee@example.com",
        invitedAt: "2026-01-02T00:00:00.000Z",
        status: PropertyInviteStatus.REVOKED,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("revoked-2");
  });

  test("prefers pending over declined for the same email", () => {
    const result = pickCanonicalPropertyMemberInvitesForAdmin([
      makeInvite({
        id: "declined-1",
        email: "invitee@example.com",
        invitedAt: "2026-01-02T00:00:00.000Z",
        status: PropertyInviteStatus.DECLINED,
      }),
      makeInvite({
        id: "pending-1",
        email: "invitee@example.com",
        invitedAt: "2026-01-01T00:00:00.000Z",
        status: PropertyInviteStatus.PENDING_ACCEPTANCE,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("pending-1");
  });

  test("keeps one canonical row per distinct email", () => {
    const result = pickCanonicalPropertyMemberInvitesForAdmin([
      makeInvite({
        id: "a-revoked",
        email: "a@example.com",
        invitedAt: "2026-01-01T00:00:00.000Z",
        status: PropertyInviteStatus.REVOKED,
      }),
      makeInvite({
        id: "a-pending",
        email: "a@example.com",
        invitedAt: "2026-01-02T00:00:00.000Z",
        status: PropertyInviteStatus.PENDING_INVITE,
      }),
      makeInvite({
        id: "b-pending",
        email: "b@example.com",
        invitedAt: "2026-01-01T00:00:00.000Z",
        status: PropertyInviteStatus.PENDING_INVITE,
      }),
    ]);

    expect(result.map((invite) => invite.id).sort()).toEqual(["a-pending", "b-pending"]);
  });
});
