import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ICreateLeasePortalInviteResult, ILeaseTenantMembership } from "@/packages/shared";
import { TenantMembershipStatus } from "@/packages/shared";
import { makeLease, makeMembership } from "@/test-fixtures/domain";
import { mockAsyncFn } from "@/test-fixtures/mocks";

const mockRetargetPendingInvite = mockAsyncFn((): Promise<ICreateLeasePortalInviteResult> =>
  Promise.resolve({
    emailSent: true,
    membership: makeMembership({ inviteEmail: "new@example.com" }),
  })
);
const mockRevokeInvite = mockAsyncFn((): Promise<ILeaseTenantMembership> =>
  Promise.resolve(makeMembership({ status: TenantMembershipStatus.REVOKED }))
);

mock.module("./tenant-portal-invite-service", () => ({
  tenantPortalInviteService: {
    retargetPendingInvite: mockRetargetPendingInvite,
    revokeInvite: mockRevokeInvite,
  },
}));

const { applyPendingPortalInviteEmailChange } =
  await import("./pending-portal-invite-email-change");

describe("applyPendingPortalInviteEmailChange", () => {
  beforeEach(() => {
    mockRetargetPendingInvite.mockReset();
    mockRevokeInvite.mockReset();
    mockRetargetPendingInvite.mockResolvedValue({
      emailSent: true,
      membership: makeMembership({ inviteEmail: "new@example.com" }),
    });
    mockRevokeInvite.mockResolvedValue(makeMembership({ status: TenantMembershipStatus.REVOKED }));
  });

  test("retargets when pending invite email changes", async () => {
    await applyPendingPortalInviteEmailChange({
      lease: makeLease(),
      membership: makeMembership({
        inviteEmail: "old@example.com",
        status: TenantMembershipStatus.PENDING_INVITE,
      }),
      nextInviteEmail: "new@example.com",
      previousInviteEmail: "old@example.com",
    });

    expect(mockRetargetPendingInvite).toHaveBeenCalledWith({
      inviteEmail: "new@example.com",
      leaseId: "lease-1",
      membershipId: "membership-1",
      propertyId: "property-1",
    });
    expect(mockRevokeInvite).not.toHaveBeenCalled();
  });

  test("revokes when pending invite email is cleared", async () => {
    await applyPendingPortalInviteEmailChange({
      lease: makeLease(),
      membership: makeMembership({
        inviteEmail: "old@example.com",
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId: "tenant-1",
      }),
      nextInviteEmail: null,
      previousInviteEmail: "old@example.com",
    });

    expect(mockRevokeInvite).toHaveBeenCalledWith({
      leaseId: "lease-1",
      membershipId: "membership-1",
      propertyId: "property-1",
    });
    expect(mockRetargetPendingInvite).not.toHaveBeenCalled();
  });

  test("no-ops when normalized email is unchanged", async () => {
    await applyPendingPortalInviteEmailChange({
      lease: makeLease(),
      membership: makeMembership({
        inviteEmail: "same@example.com",
        status: TenantMembershipStatus.PENDING_INVITE,
      }),
      nextInviteEmail: "  Same@Example.com ",
      previousInviteEmail: "same@example.com",
    });

    expect(mockRetargetPendingInvite).not.toHaveBeenCalled();
    expect(mockRevokeInvite).not.toHaveBeenCalled();
  });

  test("no-ops for listed memberships", async () => {
    await applyPendingPortalInviteEmailChange({
      lease: makeLease(),
      membership: makeMembership({
        inviteEmail: "old@example.com",
        status: TenantMembershipStatus.LISTED,
      }),
      nextInviteEmail: "new@example.com",
      previousInviteEmail: "old@example.com",
    });

    expect(mockRetargetPendingInvite).not.toHaveBeenCalled();
    expect(mockRevokeInvite).not.toHaveBeenCalled();
  });
});
