import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership, IPropertyLongStay, ITenantUser } from "@/packages/shared";
import {
  PropertyLongStayStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "@/packages/shared";

const mockFindByIdLease = mock((): Promise<IPropertyLongStay | null> => Promise.resolve(null));
const mockSetUnverifiedPhoneIfNull = mock((): Promise<ITenantUser | null> => Promise.resolve(null));

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: { findById: mockFindByIdLease },
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: { setUnverifiedPhoneIfNull: mockSetUnverifiedPhoneIfNull },
}));

const { syncLeasePhoneToTenantUserOnAccept } =
  await import("./sync-lease-phone-to-tenant-on-accept");

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: "2026-01-02T00:00:00.000Z",
    contactPhone: null,
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

function makeTenant(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "jane@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Jane Tenant",
    phone: null,
    phoneVerifiedAt: null,
    smsConsentedAt: null,
    smsOptedOutAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLease(overrides: Partial<IPropertyLongStay> = {}): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Jane Tenant",
    id: "lease-1",
    leaseEndDate: "2026-12-31",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "property-1",
    secondaryTenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenantEmail: "jane@example.com",
    tenantPhone: "+13055550100",
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("syncLeasePhoneToTenantUserOnAccept", () => {
  beforeEach(() => {
    mockFindByIdLease.mockReset();
    mockSetUnverifiedPhoneIfNull.mockReset();
    mockFindByIdLease.mockResolvedValue(makeLease());
  });

  test("copies lease phone for primary accept when user phone is null", async () => {
    const syncedUser = makeTenant({ phone: "+13055550100" });
    mockSetUnverifiedPhoneIfNull.mockResolvedValue(syncedUser);

    const result = await syncLeasePhoneToTenantUserOnAccept(
      makeMembership(),
      makeTenant(),
      makeLease()
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
      makeTenant(),
      makeLease()
    );

    expect(mockSetUnverifiedPhoneIfNull).toHaveBeenCalledWith("tenant-1", "+13055550100");
    expect(mockFindByIdLease).not.toHaveBeenCalled();
    expect(result.phone).toBe("+13055550100");
    expect(result.phoneVerifiedAt).toBeNull();
  });

  test("skips secondary accept when membership contact_phone is missing or invalid E.164", async () => {
    const tenant = makeTenant();
    const secondary = {
      contactPhone: null,
      role: TenantMembershipRole.SECONDARY,
    } as const;

    await syncLeasePhoneToTenantUserOnAccept(makeMembership(secondary), tenant, makeLease());
    await syncLeasePhoneToTenantUserOnAccept(
      makeMembership({ ...secondary, contactPhone: "not-e164" }),
      tenant,
      makeLease()
    );

    expect(mockSetUnverifiedPhoneIfNull).not.toHaveBeenCalled();
  });

  test("skips when tenant already has a phone", async () => {
    const tenant = makeTenant({ phone: "+13055550999" });

    const result = await syncLeasePhoneToTenantUserOnAccept(makeMembership(), tenant, makeLease());

    expect(mockSetUnverifiedPhoneIfNull).not.toHaveBeenCalled();
    expect(result).toBe(tenant);
  });

  test("skips when lease phone is missing or invalid E.164", async () => {
    const tenant = makeTenant();

    await syncLeasePhoneToTenantUserOnAccept(
      makeMembership(),
      tenant,
      makeLease({ tenantPhone: null })
    );
    await syncLeasePhoneToTenantUserOnAccept(
      makeMembership(),
      tenant,
      makeLease({ tenantPhone: "not-e164" })
    );

    expect(mockSetUnverifiedPhoneIfNull).not.toHaveBeenCalled();
  });

  test("loads lease when not passed", async () => {
    await syncLeasePhoneToTenantUserOnAccept(makeMembership(), makeTenant());

    expect(mockFindByIdLease).toHaveBeenCalledWith("lease-1");
    expect(mockSetUnverifiedPhoneIfNull).toHaveBeenCalledWith("tenant-1", "+13055550100");
  });
});
