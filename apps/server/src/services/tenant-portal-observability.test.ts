import { beforeEach, describe, expect, mock, test } from "bun:test";

import { makeMembership } from "@/test-fixtures/domain";

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

describe("tenant-portal-observability", () => {
  beforeEach(() => {
    mockInfo.mockClear();
  });

  test("normalizes invite email in log context", () => {
    expect(
      buildTenantPortalMembershipLogContext(makeMembership({ inviteEmail: "  Jane@Example.COM " }))
    ).toEqual({
      inviteEmail: "jane@example.com",
      leaseId: "lease-1",
      membershipId: "membership-1",
    });
  });

  test("emits stable event names for each lifecycle transition", () => {
    const membership = makeMembership({ inviteEmail: "  Jane@Example.COM " });

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
