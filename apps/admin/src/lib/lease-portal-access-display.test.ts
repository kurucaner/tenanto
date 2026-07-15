import { describe, expect, test } from "bun:test";

import {
  findLeasePortalMembership,
  formatLeasePortalAdminStatus,
  getLeasePortalRowState,
} from "./lease-portal-access-display";

const memberships = [
  {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Alex",
    endedAt: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "alex@example.com",
    leaseId: "lease-1",
    revokedAt: null,
    role: "primary" as const,
    status: "pending_acceptance" as const,
    tenantUserId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("formatLeasePortalAdminStatus", () => {
  test("returns Not invited when membership is missing", () => {
    expect(formatLeasePortalAdminStatus(null)).toBe("Not invited");
  });

  test("maps pending statuses to Invite pending", () => {
    expect(formatLeasePortalAdminStatus(memberships[0]!)).toBe("Invite pending");
  });
});

describe("findLeasePortalMembership", () => {
  test("matches primary tenant by normalized email", () => {
    expect(findLeasePortalMembership(memberships, "primary", "  Alex@Example.COM ")?.id).toBe(
      "membership-1"
    );
  });
});

describe("getLeasePortalRowState", () => {
  test("offers resend for pending memberships", () => {
    const state = getLeasePortalRowState(memberships[0]!, true);
    expect(state.actions).toEqual(["resend"]);
  });

  test("disables actions when email is missing", () => {
    const state = getLeasePortalRowState(null, false);
    expect(state.actions).toEqual([]);
  });
});
