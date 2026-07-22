import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LeaseErrorCode } from "@/errors/lease-errors";
import type { ILeaseTenantMembership, IPropertyLongStay, ITenantUser } from "@/packages/shared";
import { TenantMembershipStatus } from "@/packages/shared";
import { makeLease, makeMembership, makeTenant } from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolvedNull } from "@/test-fixtures/mocks";

const mockLoadPrimaryMembershipForLease = mockResolvedNull<ILeaseTenantMembership>();
const mockFindTenantById = mockResolvedNull<ITenantUser>();
const mockUpdateName = mockAsyncFn((_tenantUserId: string, name: string) =>
  Promise.resolve(makeTenant({ name }))
);
const mockUpdateUnverifiedPhone = mockAsyncFn((_tenantUserId: string, phone: string | null) =>
  Promise.resolve(makeTenant({ phone }))
);
const mockUpdateLease = mockAsyncFn((_id: string, patch: Partial<IPropertyLongStay>) =>
  Promise.resolve(makeLease(patch))
);
const mockUpdatePendingPrimaryContact = mockResolvedNull<ILeaseTenantMembership>();
const mockApplyPendingPortalInviteEmailChange = mockAsyncFn(() => Promise.resolve());

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

mock.module("./pending-portal-invite-email-change", () => ({
  applyPendingPortalInviteEmailChange: mockApplyPendingPortalInviteEmailChange,
}));

const { updatePrimaryTenantContact } = await import("./update-primary-tenant-contact-service");

describe("updatePrimaryTenantContact", () => {
  beforeEach(() => {
    mockLoadPrimaryMembershipForLease.mockReset();
    mockFindTenantById.mockReset();
    mockUpdateName.mockReset();
    mockUpdateUnverifiedPhone.mockReset();
    mockUpdateLease.mockReset();
    mockUpdatePendingPrimaryContact.mockReset();
    mockApplyPendingPortalInviteEmailChange.mockReset();

    mockUpdateName.mockImplementation(async (_tenantUserId, name) => makeTenant({ name }));
    mockUpdateUnverifiedPhone.mockImplementation(async (_tenantUserId, phone) =>
      makeTenant({ phone })
    );
    mockUpdateLease.mockImplementation(async (_id, patch) => makeLease(patch));
    mockApplyPendingPortalInviteEmailChange.mockResolvedValue(undefined);
  });

  test("updates linked tenant user and dual-writes lease snapshot", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        displayName: "Lease Primary",
        inviteEmail: "lease@example.com",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
    );
    mockFindTenantById.mockResolvedValue(
      makeTenant({
        email: "linked@example.com",
        name: "Linked Tenant",
        phone: "+13055550999",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
    );
    mockUpdateName.mockImplementation(async (_tenantUserId, name) =>
      makeTenant({
        email: "linked@example.com",
        name,
        phone: "+13055550999",
      })
    );
    mockUpdateUnverifiedPhone.mockImplementation(async (_tenantUserId, phone) =>
      makeTenant({ email: "linked@example.com", name: "Updated Name", phone })
    );

    await updatePrimaryTenantContact(
      makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      {
        guestName: "Updated Name",
        tenantEmail: "linked@example.com",
        tenantPhone: "+13055550111",
      }
    );

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
    mockLoadPrimaryMembershipForLease.mockResolvedValue(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        displayName: "Lease Primary",
        inviteEmail: "lease@example.com",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
    );
    mockFindTenantById.mockResolvedValue(
      makeTenant({
        email: "linked@example.com",
        name: "Linked Tenant",
        phone: "+13055550999",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
    );

    await expect(
      updatePrimaryTenantContact(
        makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+13055550100",
        }),
        { tenantEmail: "other@example.com" }
      )
    ).rejects.toMatchObject({ code: LeaseErrorCode.LINKED_TENANT_CONTACT });
    expect(mockUpdateLease).not.toHaveBeenCalled();
  });

  test("rejects verified phone changes for linked tenants", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(
      makeMembership({
        acceptedAt: "2026-01-02T00:00:00.000Z",
        displayName: "Lease Primary",
        inviteEmail: "lease@example.com",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
    );
    mockFindTenantById.mockResolvedValue(
      makeTenant({
        phone: "+13055550999",
        phoneVerifiedAt: "2026-01-02T00:00:00.000Z",
      })
    );

    await expect(
      updatePrimaryTenantContact(
        makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+13055550100",
        }),
        { tenantPhone: "+13055550111" }
      )
    ).rejects.toMatchObject({ code: LeaseErrorCode.LINKED_TENANT_CONTACT });
    expect(mockUpdateUnverifiedPhone).not.toHaveBeenCalled();
  });

  test("updates lease only when unlinked", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(null);

    await updatePrimaryTenantContact(
      makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      {
        guestName: "Unlinked Name",
        tenantPhone: "+13055550111",
      }
    );

    expect(mockUpdateName).not.toHaveBeenCalled();
    expect(mockUpdateUnverifiedPhone).not.toHaveBeenCalled();
    expect(mockUpdateLease).toHaveBeenCalledWith("lease-1", {
      guestName: "Unlinked Name",
      tenantPhone: "+13055550111",
    });
  });

  test("syncs pending display name and retargets invite when email changes", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(
      makeMembership({
        inviteEmail: "lease@example.com",
        status: TenantMembershipStatus.PENDING_INVITE,
        tenantUserId: null,
      })
    );

    await updatePrimaryTenantContact(
      makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      {
        guestName: "Pending Name",
        tenantEmail: "pending@example.com",
      }
    );

    expect(mockUpdatePendingPrimaryContact).toHaveBeenCalledWith("membership-1", {
      displayName: "Pending Name",
    });
    expect(mockApplyPendingPortalInviteEmailChange).toHaveBeenCalledWith(
      expect.objectContaining({
        membership: expect.objectContaining({ id: "membership-1" }),
        nextInviteEmail: "pending@example.com",
        previousInviteEmail: "lease@example.com",
      })
    );
  });

  test("revokes pending invite when email is cleared", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(
      makeMembership({
        inviteEmail: "lease@example.com",
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId: "tenant-old",
      })
    );

    await updatePrimaryTenantContact(
      makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      { tenantEmail: null }
    );

    expect(mockApplyPendingPortalInviteEmailChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nextInviteEmail: null,
        previousInviteEmail: "lease@example.com",
      })
    );
  });

  test("does not retarget when pending email is unchanged", async () => {
    mockLoadPrimaryMembershipForLease.mockResolvedValue(
      makeMembership({
        inviteEmail: "lease@example.com",
        status: TenantMembershipStatus.PENDING_INVITE,
        tenantUserId: null,
      })
    );

    await updatePrimaryTenantContact(
      makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      { guestName: "Renamed Only" }
    );

    expect(mockUpdatePendingPrimaryContact).toHaveBeenCalledWith("membership-1", {
      displayName: "Renamed Only",
    });
    expect(mockApplyPendingPortalInviteEmailChange).not.toHaveBeenCalled();
  });
});
