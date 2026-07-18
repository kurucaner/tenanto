import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LeaseErrorCode } from "@/errors/lease-errors";
import type { ILeaseTenantMembership, IPropertyLongStay, ITenantUser } from "@/packages/shared";
import {
  PropertyLongStayStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "@/packages/shared";

const mockLoadPrimaryMembershipForLease = mock((): Promise<ILeaseTenantMembership | null> =>
  Promise.resolve(null)
);
const mockFindTenantById = mock((): Promise<ITenantUser | null> => Promise.resolve(null));
const mockUpdateName = mock((_tenantUserId: string, name: string): Promise<ITenantUser> =>
  Promise.resolve(makeTenant({ name }))
);
const mockUpdateUnverifiedPhone = mock(
  (_tenantUserId: string, phone: string | null): Promise<ITenantUser> =>
    Promise.resolve(makeTenant({ phone }))
);
const mockUpdateLease = mock(
  (_id: string, patch: Partial<IPropertyLongStay>): Promise<IPropertyLongStay> =>
    Promise.resolve(makeLease(patch))
);
const mockUpdatePendingPrimaryContact = mock((): Promise<ILeaseTenantMembership | null> =>
  Promise.resolve(null)
);

mock.module("@/db/lease-tenant-memberships", () => ({
  leaseTenantMembershipsDb: {
    updatePendingPrimaryContact: mockUpdatePendingPrimaryContact,
  },
  loadPrimaryMembershipForLease: mockLoadPrimaryMembershipForLease,
}));

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: { updateLease: mockUpdateLease },
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findById: mockFindTenantById,
    updateName: mockUpdateName,
    updateUnverifiedPhone: mockUpdateUnverifiedPhone,
  },
}));

const { updatePrimaryTenantContact } = await import("./update-primary-tenant-contact-service");

function makeLease(overrides: Partial<IPropertyLongStay> = {}): IPropertyLongStay {
  return {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Lease Primary",
    id: "lease-1",
    leaseEndDate: "2027-01-01",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "property-1",
    secondaryTenants: [],
    status: PropertyLongStayStatus.ACTIVE,
    tenantEmail: "lease@example.com",
    tenantPhone: "+13055550100",
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: "2026-01-02T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Lease Primary",
    endedAt: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "lease@example.com",
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
    email: "linked@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Linked Tenant",
    phone: "+13055550999",
    phoneVerifiedAt: null,
    smsConsentedAt: null,
    smsOptedOutAt: null,
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("updatePrimaryTenantContact", () => {
  beforeEach(() => {
    mockLoadPrimaryMembershipForLease.mockReset();
    mockFindTenantById.mockReset();
    mockUpdateName.mockReset();
    mockUpdateUnverifiedPhone.mockReset();
    mockUpdateLease.mockReset();
    mockUpdatePendingPrimaryContact.mockReset();

    mockUpdateName.mockImplementation(async (_tenantUserId, name) => makeTenant({ name }));
    mockUpdateUnverifiedPhone.mockImplementation(async (_tenantUserId, phone) =>
      makeTenant({ phone })
    );
    mockUpdateLease.mockImplementation(async (_id, patch) => makeLease(patch));
  });

  test("updates linked tenant user and dual-writes lease snapshot", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(makeMembership());
    mockFindTenantById.mockResolvedValue(makeTenant());
    mockUpdateUnverifiedPhone.mockImplementation(async (_tenantUserId, phone) =>
      makeTenant({ name: "Updated Name", phone })
    );

    await updatePrimaryTenantContact(makeLease(), {
      guestName: "Updated Name",
      tenantEmail: "linked@example.com",
      tenantPhone: "+13055550111",
    });

    expect(mockUpdateName).toHaveBeenCalledWith("tenant-1", "Updated Name");
    expect(mockUpdateUnverifiedPhone).toHaveBeenCalledWith("tenant-1", "+13055550111");
    expect(mockUpdateLease).toHaveBeenCalledWith("lease-1", {
      guestName: "Updated Name",
      tenantEmail: "linked@example.com",
      tenantPhone: "+13055550111",
    });
    expect(mockUpdatePendingPrimaryContact).not.toHaveBeenCalled();
  });

  test("rejects linked email changes", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(makeMembership());
    mockFindTenantById.mockResolvedValue(makeTenant());

    await expect(
      updatePrimaryTenantContact(makeLease(), { tenantEmail: "other@example.com" })
    ).rejects.toMatchObject({ code: LeaseErrorCode.LINKED_TENANT_CONTACT });
    expect(mockUpdateLease).not.toHaveBeenCalled();
  });

  test("rejects verified phone changes for linked tenants", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(makeMembership());
    mockFindTenantById.mockResolvedValue(
      makeTenant({
        phone: "+13055550999",
        phoneVerifiedAt: "2026-01-02T00:00:00.000Z",
      })
    );

    await expect(
      updatePrimaryTenantContact(makeLease(), { tenantPhone: "+13055550111" })
    ).rejects.toMatchObject({ code: LeaseErrorCode.LINKED_TENANT_CONTACT });
    expect(mockUpdateUnverifiedPhone).not.toHaveBeenCalled();
  });

  test("updates lease only when unlinked", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(null);

    await updatePrimaryTenantContact(makeLease(), {
      guestName: "Unlinked Name",
      tenantPhone: "+13055550111",
    });

    expect(mockUpdateName).not.toHaveBeenCalled();
    expect(mockUpdateUnverifiedPhone).not.toHaveBeenCalled();
    expect(mockUpdateLease).toHaveBeenCalledWith("lease-1", {
      guestName: "Unlinked Name",
      tenantPhone: "+13055550111",
    });
  });

  test("syncs pending membership fields when unlinked invite exists", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(
      makeMembership({
        status: TenantMembershipStatus.PENDING_INVITE,
        tenantUserId: null,
      })
    );

    await updatePrimaryTenantContact(makeLease(), {
      guestName: "Pending Name",
      tenantEmail: "pending@example.com",
    });

    expect(mockUpdatePendingPrimaryContact).toHaveBeenCalledWith("membership-1", {
      displayName: "Pending Name",
      inviteEmail: "pending@example.com",
    });
  });
});
