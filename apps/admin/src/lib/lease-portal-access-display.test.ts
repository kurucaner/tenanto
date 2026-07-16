import { describe, expect, test } from "bun:test";

import {
  findLeasePortalMembership,
  formatLeasePortalAdminStatus,
  getLeasePortalRowState,
  getLeasePortalStatusTone,
  isSameLeasePortalActingTarget,
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

  test("maps pending statuses to Pending", () => {
    expect(formatLeasePortalAdminStatus(memberships[0]!)).toBe("Pending");
  });

  test("maps expired status to Expired", () => {
    expect(
      formatLeasePortalAdminStatus({
        ...memberships[0]!,
        status: "expired",
      })
    ).toBe("Expired");
  });
});

describe("findLeasePortalMembership", () => {
  test("matches primary tenant by normalized email", () => {
    expect(findLeasePortalMembership(memberships, "primary", "  Alex@Example.COM ")?.id).toBe(
      "membership-1"
    );
  });
});

describe("getLeasePortalStatusTone", () => {
  test("maps labels to calm status tones", () => {
    expect(getLeasePortalStatusTone("Active")).toBe("active");
    expect(getLeasePortalStatusTone("Pending")).toBe("pending");
    expect(getLeasePortalStatusTone("Not invited")).toBe("neutral");
    expect(getLeasePortalStatusTone("Declined")).toBe("muted");
    expect(getLeasePortalStatusTone("Revoked")).toBe("muted");
  });
});

describe("isSameLeasePortalActingTarget", () => {
  test("matches primary and invite-all by kind", () => {
    expect(isSameLeasePortalActingTarget({ kind: "primary" }, { kind: "primary" })).toBe(true);
    expect(isSameLeasePortalActingTarget({ kind: "invite-all" }, { kind: "invite-all" })).toBe(
      true
    );
    expect(isSameLeasePortalActingTarget({ kind: "primary" }, { kind: "invite-all" })).toBe(false);
    expect(isSameLeasePortalActingTarget(null, { kind: "primary" })).toBe(false);
  });

  test("matches secondary targets by index", () => {
    expect(
      isSameLeasePortalActingTarget({ index: 1, kind: "secondary" }, { index: 1, kind: "secondary" })
    ).toBe(true);
    expect(
      isSameLeasePortalActingTarget({ index: 0, kind: "secondary" }, { index: 1, kind: "secondary" })
    ).toBe(false);
  });
});

describe("getLeasePortalRowState", () => {
  test("offers resend for pending memberships", () => {
    const state = getLeasePortalRowState(memberships[0]!, true);
    expect(state.actions).toEqual(["resend"]);
    expect(state.statusLabel).toBe("Pending");
    expect(state.statusTone).toBe("pending");
  });

  test("offers invite again when membership is expired", () => {
    const state = getLeasePortalRowState(
      {
        ...memberships[0]!,
        status: "expired",
      },
      true
    );
    expect(state.statusLabel).toBe("Expired");
    expect(state.actions).toEqual(["invite"]);
  });

  test("disables actions when email is missing", () => {
    const state = getLeasePortalRowState(null, false);
    expect(state.actions).toEqual([]);
  });
});
