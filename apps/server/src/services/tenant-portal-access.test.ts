import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership } from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";

const mockFindActiveByLeaseAndTenantUser = mock(() =>
  Promise.resolve(null as ILeaseTenantMembership | null)
);

mock.module("@/db/lease-tenant-memberships", () => ({
  leaseTenantMembershipsDb: {
    findActiveByLeaseAndTenantUser: mockFindActiveByLeaseAndTenantUser,
  },
}));

const { assertLeaseTenantAccess, TenantLeaseAccessDeniedError } =
  await import("./tenant-portal-access");

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: "2026-01-02T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Jane Tenant",
    endedAt: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "jane@example.com",
    leaseId: "lease-1",
    revokedAt: null,
    role: TenantMembershipRole.PRIMARY,
    status: TenantMembershipStatus.ACTIVE,
    tenantUserId: "tenant-1",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("assertLeaseTenantAccess", () => {
  beforeEach(() => {
    mockFindActiveByLeaseAndTenantUser.mockClear();
  });

  test("returns active membership when tenant has access", async () => {
    const membership = makeMembership();
    mockFindActiveByLeaseAndTenantUser.mockResolvedValueOnce(membership);

    const result = await assertLeaseTenantAccess("lease-1", "tenant-1");

    expect(result).toEqual(membership);
    expect(mockFindActiveByLeaseAndTenantUser).toHaveBeenCalledWith("lease-1", "tenant-1");
  });

  test("throws when no active membership exists", async () => {
    mockFindActiveByLeaseAndTenantUser.mockResolvedValueOnce(null);

    await expect(assertLeaseTenantAccess("lease-1", "tenant-1")).rejects.toBeInstanceOf(
      TenantLeaseAccessDeniedError
    );
  });
});
