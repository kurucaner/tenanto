import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyLongStay, ITenantUser } from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";
import { makeLease, makeMembership, makeTenant } from "@/test-fixtures/domain";
import { mockResolvedNull } from "@/test-fixtures/mocks";

const mockFindByIdLease = mockResolvedNull<IPropertyLongStay>();
const mockSetUnverifiedPhoneIfNull = mockResolvedNull<ITenantUser>();

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: { findById: mockFindByIdLease },
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: { setUnverifiedPhoneIfNull: mockSetUnverifiedPhoneIfNull },
}));

const { syncLeasePhoneToTenantUserOnAccept } =
  await import("./sync-lease-phone-to-tenant-on-accept");

describe("syncLeasePhoneToTenantUserOnAccept", () => {
  beforeEach(() => {
    mockFindByIdLease.mockReset();
    mockSetUnverifiedPhoneIfNull.mockReset();
    mockFindByIdLease.mockResolvedValue(makeLease({ tenantPhone: "+13055550100" }));
  });

  test("copies lease phone for primary accept when user phone is null", async () => {
    const syncedUser = makeTenant({ phone: "+13055550100" });
    mockSetUnverifiedPhoneIfNull.mockResolvedValue(syncedUser);

    const result = await syncLeasePhoneToTenantUserOnAccept(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      makeTenant({ email: "jane@example.com" }),
      makeLease({ tenantPhone: "+13055550100" })
    );

    expect(mockSetUnverifiedPhoneIfNull).toHaveBeenCalledWith("tenant-1", "+13055550100");
    expect(result.phone).toBe("+13055550100");
    expect(result.phoneVerifiedAt).toBeNull();
    expect(mockFindByIdLease).not.toHaveBeenCalled();
  });

  test("copies membership contact_phone for secondary accept when user phone is null", async () => {
    const syncedUser = makeTenant({ phone: "+13055550100" });
    mockSetUnverifiedPhoneIfNull.mockResolvedValue(syncedUser);

    const result = await syncLeasePhoneToTenantUserOnAccept(
      makeMembership({
        contactPhone: "+13055550100",
        role: TenantMembershipRole.SECONDARY,
      }),
      makeTenant({ email: "jane@example.com" }),
      makeLease({ tenantPhone: "+13055550100" })
    );

    expect(mockSetUnverifiedPhoneIfNull).toHaveBeenCalledWith("tenant-1", "+13055550100");
    expect(mockFindByIdLease).not.toHaveBeenCalled();
    expect(result.phone).toBe("+13055550100");
    expect(result.phoneVerifiedAt).toBeNull();
  });

  test("skips secondary accept when membership contact_phone is missing or invalid E.164", async () => {
    const tenant = makeTenant({ email: "jane@example.com" });
    const secondary = {
      contactPhone: null,
      role: TenantMembershipRole.SECONDARY,
    } as const;

    await syncLeasePhoneToTenantUserOnAccept(
      makeMembership(secondary),
      tenant,
      makeLease({ tenantPhone: "+13055550100" })
    );
    await syncLeasePhoneToTenantUserOnAccept(
      makeMembership({ ...secondary, contactPhone: "not-e164" }),
      tenant,
      makeLease({ tenantPhone: "+13055550100" })
    );

    expect(mockSetUnverifiedPhoneIfNull).not.toHaveBeenCalled();
  });

  test("skips when tenant already has a phone", async () => {
    const tenant = makeTenant({ phone: "+13055550999" });

    const result = await syncLeasePhoneToTenantUserOnAccept(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      tenant,
      makeLease({ tenantPhone: "+13055550100" })
    );

    expect(mockSetUnverifiedPhoneIfNull).not.toHaveBeenCalled();
    expect(result).toBe(tenant);
  });

  test("skips when lease phone is missing or invalid E.164", async () => {
    const tenant = makeTenant({ email: "jane@example.com" });

    await syncLeasePhoneToTenantUserOnAccept(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      tenant,
      makeLease({ tenantPhone: null })
    );
    await syncLeasePhoneToTenantUserOnAccept(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      tenant,
      makeLease({ tenantPhone: "not-e164" })
    );

    expect(mockSetUnverifiedPhoneIfNull).not.toHaveBeenCalled();
  });

  test("loads lease when not passed", async () => {
    await syncLeasePhoneToTenantUserOnAccept(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      makeTenant({ email: "jane@example.com" })
    );

    expect(mockFindByIdLease).toHaveBeenCalledWith("lease-1");
    expect(mockSetUnverifiedPhoneIfNull).toHaveBeenCalledWith("tenant-1", "+13055550100");
  });
});
