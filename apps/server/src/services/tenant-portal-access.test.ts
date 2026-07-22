import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LeaseErrorCode } from "@/errors/lease-errors";
import type { ILeaseTenantMembership } from "@/packages/shared";
import { TenantMembershipStatus } from "@/packages/shared";
import { makeMembership } from "@/test-fixtures/domain";

const mockFindActiveByLeaseAndTenantUser = mock(() =>
  Promise.resolve(null as ILeaseTenantMembership | null)
);
const mockFindByLeaseAndTenantUserWithStatuses = mock(() =>
  Promise.resolve(null as ILeaseTenantMembership | null)
);

mock.module("@/db/lease-tenant-memberships", () => ({
  leaseTenantMembershipsDb: {
    findActiveByLeaseAndTenantUser: mockFindActiveByLeaseAndTenantUser,
    findByLeaseAndTenantUserWithStatuses: mockFindByLeaseAndTenantUserWithStatuses,
  },
}));

const { assertLeaseTenantAccess, assertLeaseTenantReadAccess } =
  await import("./tenant-portal-access");

describe("assertLeaseTenantAccess", () => {
  beforeEach(() => {
    mockFindActiveByLeaseAndTenantUser.mockClear();
  });

  test("returns active membership when tenant has access", async () => {
    const membership = makeMembership({
      acceptedAt: "2026-01-02T00:00:00.000Z",
      expiresAt: "2026-02-01T00:00:00.000Z",
      status: TenantMembershipStatus.ACTIVE,
      tenantUserId: "tenant-1",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    mockFindActiveByLeaseAndTenantUser.mockResolvedValueOnce(membership);

    const result = await assertLeaseTenantAccess("lease-1", "tenant-1");

    expect(result).toEqual(membership);
    expect(mockFindActiveByLeaseAndTenantUser).toHaveBeenCalledWith("lease-1", "tenant-1");
  });

  test("throws when no active membership exists", async () => {
    mockFindActiveByLeaseAndTenantUser.mockResolvedValueOnce(null);

    await expect(assertLeaseTenantAccess("lease-1", "tenant-1")).rejects.toMatchObject({
      code: LeaseErrorCode.TENANT_LEASE_ACCESS_DENIED,
    });
  });
});

describe("assertLeaseTenantReadAccess", () => {
  beforeEach(() => {
    mockFindActiveByLeaseAndTenantUser.mockClear();
    mockFindByLeaseAndTenantUserWithStatuses.mockClear();
    mockFindActiveByLeaseAndTenantUser.mockResolvedValue(null);
    mockFindByLeaseAndTenantUserWithStatuses.mockResolvedValue(null);
  });

  test("returns active membership when present even if ended also exists", async () => {
    const active = makeMembership({
      acceptedAt: "2026-01-02T00:00:00.000Z",
      expiresAt: "2026-02-01T00:00:00.000Z",
      status: TenantMembershipStatus.ACTIVE,
      tenantUserId: "tenant-1",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    mockFindActiveByLeaseAndTenantUser.mockResolvedValueOnce(active);

    const result = await assertLeaseTenantReadAccess("lease-1", "tenant-1");

    expect(result).toEqual(active);
    expect(mockFindActiveByLeaseAndTenantUser).toHaveBeenCalledWith("lease-1", "tenant-1");
    expect(mockFindByLeaseAndTenantUserWithStatuses).not.toHaveBeenCalled();
  });

  test("returns ended membership for archive read access when no active", async () => {
    const membership = makeMembership({
      acceptedAt: "2026-01-02T00:00:00.000Z",
      expiresAt: "2026-02-01T00:00:00.000Z",
      status: TenantMembershipStatus.ENDED,
      tenantUserId: "tenant-1",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    mockFindByLeaseAndTenantUserWithStatuses.mockResolvedValueOnce(membership);

    const result = await assertLeaseTenantReadAccess("lease-1", "tenant-1");

    expect(result).toEqual(membership);
    expect(mockFindByLeaseAndTenantUserWithStatuses).toHaveBeenCalledWith("lease-1", "tenant-1", [
      TenantMembershipStatus.ENDED,
    ]);
  });

  test("throws when no active or ended membership exists", async () => {
    await expect(assertLeaseTenantReadAccess("lease-1", "tenant-1")).rejects.toMatchObject({
      code: LeaseErrorCode.TENANT_LEASE_ACCESS_DENIED,
    });
  });
});
