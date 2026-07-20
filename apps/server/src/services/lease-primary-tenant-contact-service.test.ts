import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership, ITenantUser } from "@/packages/shared";
import { TenantMembershipStatus } from "@/packages/shared";
import { makeLease, makeMembership, makeTenantUser } from "@/test-fixtures/domain";
import { mockResolvedNull } from "@/test-fixtures/mocks";

const mockLoadPrimaryMembershipForLease = mockResolvedNull<ILeaseTenantMembership>();
const mockFindTenantById = mockResolvedNull<ITenantUser>();

mock.module("@/db/lease-tenant-memberships", () => ({
  loadPrimaryMembershipForLease: mockLoadPrimaryMembershipForLease,
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: { findById: mockFindTenantById },
}));

const { resolvePrimaryTenantContactForLongStay } =
  await import("./lease-primary-tenant-contact-service");

describe("resolvePrimaryTenantContactForLongStay", () => {
  beforeEach(() => {
    mockLoadPrimaryMembershipForLease.mockReset();
    mockFindTenantById.mockReset();
  });

  test("returns lease fallback when no primary membership exists", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(null);

    await expect(
      resolvePrimaryTenantContactForLongStay(
        makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+15551234567",
        })
      )
    ).resolves.toEqual({
      effectiveEmail: "lease@example.com",
      effectiveName: "Lease Primary",
      effectivePhone: "+15551234567",
      membershipId: null,
      membershipStatus: null,
      source: "lease",
      tenantUserId: null,
    });
    expect(mockFindTenantById).not.toHaveBeenCalled();
  });

  test("returns linked tenant user contact after invite accept", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        displayName: "Lease Primary",
        inviteEmail: "lease@example.com",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-user-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
    );
    mockFindTenantById.mockResolvedValue(
      makeTenantUser({
        email: "linked@example.com",
        id: "tenant-user-1",
        name: "Linked Tenant",
        phone: "+15559876543",
        phoneVerifiedAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
    );

    await expect(
      resolvePrimaryTenantContactForLongStay(
        makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+15551234567",
        })
      )
    ).resolves.toEqual({
      effectiveEmail: "linked@example.com",
      effectiveName: "Linked Tenant",
      effectivePhone: "+15559876543",
      membershipId: "membership-1",
      membershipStatus: TenantMembershipStatus.ACTIVE,
      source: "linked_user",
      tenantUserId: "tenant-user-1",
    });
    expect(mockFindTenantById).toHaveBeenCalledWith("tenant-user-1");
  });
});
