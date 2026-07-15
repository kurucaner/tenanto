import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership } from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";

const mockFindById = mock(() => Promise.resolve(null as ILeaseTenantMembership | null));
const mockQuery = mock(() =>
  Promise.resolve({
    rowCount: 1,
    rows: [],
  })
);

mock.module("@/db/pool", () => ({
  pool: {
    query: mockQuery,
  },
}));

const { InvalidTenantMembershipTransitionError, leaseTenantMembershipsDb } =
  await import("./lease-tenant-memberships");

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
    inviteEmail: "jane@example.com",
    leaseId: "lease-1",
    revokedAt: null,
    role: TenantMembershipRole.PRIMARY,
    status: TenantMembershipStatus.PENDING_INVITE,
    tenantUserId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("leaseTenantMembershipsDb.transitionStatus", () => {
  beforeEach(() => {
    mockFindById.mockClear();
    mockQuery.mockClear();
    leaseTenantMembershipsDb.findById = mockFindById;
  });

  test("rejects invalid status transitions", async () => {
    mockFindById.mockResolvedValueOnce(makeMembership({ status: TenantMembershipStatus.DECLINED }));

    await expect(
      leaseTenantMembershipsDb.transitionStatus("membership-1", TenantMembershipStatus.ACTIVE)
    ).rejects.toBeInstanceOf(InvalidTenantMembershipTransitionError);
  });

  test("returns null when membership does not exist", async () => {
    mockFindById.mockResolvedValueOnce(null);

    const result = await leaseTenantMembershipsDb.transitionStatus(
      "missing",
      TenantMembershipStatus.ACTIVE
    );

    expect(result).toBeNull();
  });
});
