import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyInvite } from "@/packages/shared";
import { PropertyInviteStatus, PropertyRole } from "@/packages/shared";

const mockFindPendingByEmail = mock(() => Promise.resolve([] as IPropertyInvite[]));
const mockFindOneMember = mock(() => Promise.resolve(null));
const mockAddMember = mock(() => Promise.resolve());
const mockUpdateInviteStatus = mock(() => Promise.resolve(null));

mock.module("@/db/property-invites", () => ({
  propertyInvitesDb: {
    findPendingByEmail: mockFindPendingByEmail,
    updateStatus: mockUpdateInviteStatus,
  },
}));

mock.module("@/db/property-members", () => ({
  propertyMembersDb: {
    add: mockAddMember,
    findOne: mockFindOneMember,
  },
}));

const { acceptPendingPropertyInvitesForUser } =
  await import("./property-invite-acceptance-service");

function makeInvite(overrides: Partial<IPropertyInvite> = {}): IPropertyInvite {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    email: "jane@example.com",
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

describe("acceptPendingPropertyInvitesForUser", () => {
  beforeEach(() => {
    mockFindPendingByEmail.mockClear();
    mockFindOneMember.mockClear();
    mockAddMember.mockClear();
    mockUpdateInviteStatus.mockClear();
    mockFindOneMember.mockResolvedValue(null);
  });

  test("no-ops when email is blank", async () => {
    await acceptPendingPropertyInvitesForUser("user-1", "   ");

    expect(mockFindPendingByEmail).not.toHaveBeenCalled();
  });

  test("adds member and marks invite accepted for pending invites", async () => {
    mockFindPendingByEmail.mockResolvedValueOnce([makeInvite()]);

    await acceptPendingPropertyInvitesForUser("user-1", "Jane@Example.com");

    expect(mockFindPendingByEmail).toHaveBeenCalledWith("jane@example.com");
    expect(mockAddMember).toHaveBeenCalledWith(
      "property-1",
      "user-1",
      PropertyRole.MANAGER,
      "owner-1"
    );
    expect(mockUpdateInviteStatus).toHaveBeenCalledWith("invite-1", "accepted");
  });

  test("marks invite accepted without adding when user is already a member", async () => {
    mockFindPendingByEmail.mockResolvedValueOnce([makeInvite()]);
    mockFindOneMember.mockResolvedValueOnce({
      addedBy: "owner-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "membership-1",
      propertyId: "property-1",
      role: PropertyRole.MANAGER,
      updatedAt: "2026-01-01T00:00:00.000Z",
      user: { email: "jane@example.com", id: "user-1", name: "Jane" },
      userId: "user-1",
    });

    await acceptPendingPropertyInvitesForUser("user-1", "jane@example.com");

    expect(mockAddMember).not.toHaveBeenCalled();
    expect(mockUpdateInviteStatus).toHaveBeenCalledWith("invite-1", "accepted");
  });

  test("marks invite accepted when add hits unique violation race", async () => {
    mockFindPendingByEmail.mockResolvedValueOnce([makeInvite()]);
    mockAddMember.mockRejectedValueOnce({ code: "23505" });

    await acceptPendingPropertyInvitesForUser("user-1", "jane@example.com");

    expect(mockUpdateInviteStatus).toHaveBeenCalledWith("invite-1", "accepted");
  });
});
