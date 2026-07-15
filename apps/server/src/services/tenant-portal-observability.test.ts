import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership } from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";

const mockInfo = mock((_event: string, _context?: Record<string, unknown>) => undefined);

mock.module("./winston", () => ({
  WinstonLogger: {
    info: mockInfo,
  },
}));

const {
  buildTenantPortalMembershipLogContext,
  logTenantPortalAccepted,
  logTenantPortalDeclined,
  logTenantPortalEnded,
  logTenantPortalInvited,
  logTenantPortalMembershipsEnded,
  logTenantPortalResent,
  logTenantPortalRevoked,
} = await import("./tenant-portal-observability");

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Jane Tenant",
    endedAt: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "  Jane@Example.COM ",
    leaseId: "lease-1",
    revokedAt: null,
    role: TenantMembershipRole.PRIMARY,
    status: TenantMembershipStatus.PENDING_INVITE,
    tenantUserId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("tenant-portal-observability", () => {
  beforeEach(() => {
    mockInfo.mockClear();
  });

  test("normalizes invite email in log context", () => {
    expect(buildTenantPortalMembershipLogContext(makeMembership())).toEqual({
      inviteEmail: "jane@example.com",
      leaseId: "lease-1",
      membershipId: "membership-1",
    });
  });

  test("emits stable event names for each lifecycle transition", () => {
    const membership = makeMembership();

    logTenantPortalInvited(membership);
    logTenantPortalResent(membership);
    logTenantPortalRevoked(membership);
    logTenantPortalAccepted(membership);
    logTenantPortalDeclined(membership);
    logTenantPortalEnded(membership);

    expect(mockInfo.mock.calls.map((call) => call[0])).toEqual([
      "tenant_portal.invited",
      "tenant_portal.resent",
      "tenant_portal.revoked",
      "tenant_portal.accepted",
      "tenant_portal.declined",
      "tenant_portal.ended",
    ]);

    for (const call of mockInfo.mock.calls) {
      expect(call[1]).toEqual({
        inviteEmail: "jane@example.com",
        leaseId: "lease-1",
        membershipId: "membership-1",
      });
      expect(JSON.stringify(call[1])).not.toContain("token");
    }
  });

  test("logs one ended event per membership", () => {
    logTenantPortalMembershipsEnded([
      makeMembership({ id: "membership-1" }),
      makeMembership({ id: "membership-2", inviteEmail: "other@example.com" }),
    ]);

    expect(mockInfo).toHaveBeenCalledTimes(2);
    expect(mockInfo).toHaveBeenNthCalledWith(1, "tenant_portal.ended", {
      inviteEmail: "jane@example.com",
      leaseId: "lease-1",
      membershipId: "membership-1",
    });
    expect(mockInfo).toHaveBeenNthCalledWith(2, "tenant_portal.ended", {
      inviteEmail: "other@example.com",
      leaseId: "lease-1",
      membershipId: "membership-2",
    });
  });
});
