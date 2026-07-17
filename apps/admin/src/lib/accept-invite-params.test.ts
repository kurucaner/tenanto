import { describe, expect, test } from "bun:test";

import {
  findPendingMemberInviteById,
  parseAcceptInviteSearchParams,
} from "@/lib/accept-invite-params";
import { PropertyInviteStatus, PropertyRole } from "@/packages/shared";

describe("parseAcceptInviteSearchParams", () => {
  test("parses token and inviteId from search params", () => {
    const params = new URLSearchParams("token=abc123&inviteId=invite-1&other=ignored");
    expect(parseAcceptInviteSearchParams(params)).toEqual({
      inviteId: "invite-1",
      token: "abc123",
    });
  });

  test("returns empty strings when params are missing", () => {
    expect(parseAcceptInviteSearchParams(new URLSearchParams())).toEqual({
      inviteId: "",
      token: "",
    });
  });
});

describe("findPendingMemberInviteById", () => {
  const invites = [
    {
      expiresAt: "2026-02-01T00:00:00.000Z",
      inviteId: "invite-1",
      propertyId: "property-1",
      propertyName: "Sunset Apartments",
      role: PropertyRole.MANAGER,
      roleLabel: "Manager",
      status: PropertyInviteStatus.PENDING_ACCEPTANCE,
      summary: {
        inviterEmail: "owner@example.com",
        inviterName: "Alex",
        propertyAddress: "123 Main St",
        propertyName: "Sunset Apartments",
        role: PropertyRole.MANAGER,
        roleLabel: "Manager",
      },
    },
  ];

  test("finds invite by id", () => {
    expect(findPendingMemberInviteById(invites, "invite-1")?.propertyName).toBe(
      "Sunset Apartments"
    );
  });

  test("returns undefined when invite id is missing or not found", () => {
    expect(findPendingMemberInviteById(invites, "")).toBeUndefined();
    expect(findPendingMemberInviteById(invites, "missing")).toBeUndefined();
  });
});
