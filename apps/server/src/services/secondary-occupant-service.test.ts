import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LeaseErrorCode } from "@/errors/lease-errors";
import type { ILeaseTenantMembership, ITenantUser } from "@/packages/shared";
import {
  MAX_SECONDARY_OCCUPANTS,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "@/packages/shared";
import {
  makeLease,
  makeListedMembership,
  makeMembership,
  makeTenant,
} from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolved, mockResolvedNull } from "@/test-fixtures/mocks";

const mockCountNonTerminalSecondariesForLease = mockResolved(0);
const mockCreateListedSecondary = mockAsyncFn((): Promise<ILeaseTenantMembership> =>
  Promise.resolve(
    makeListedMembership({
      contactPhone: "+13055550111",
      displayName: "Secondary Tenant",
      inviteEmail: "secondary@example.com",
    })
  )
);
const mockFindById = mockAsyncFn((): Promise<ILeaseTenantMembership | null> =>
  Promise.resolve(null)
);
const mockTransitionStatus = mockAsyncFn((): Promise<ILeaseTenantMembership | null> =>
  Promise.resolve(null)
);
const mockUpdateSecondaryContact = mockAsyncFn((): Promise<ILeaseTenantMembership | null> =>
  Promise.resolve(null)
);
const mockFindTenantById = mockAsyncFn((): Promise<ITenantUser | null> => Promise.resolve(null));
const linkedSecondaryTenant = {
  email: "linked-secondary@example.com",
  name: "Linked Secondary",
  phone: "+13055550999",
  updatedAt: "2026-01-02T00:00:00.000Z",
};
const mockUpdateName = mockAsyncFn((_tenantUserId: string, name: string): Promise<ITenantUser> =>
  Promise.resolve(makeTenant({ ...linkedSecondaryTenant, name }))
);
const mockUpdateUnverifiedPhone = mockAsyncFn(
  (_tenantUserId: string, phone: string | null): Promise<ITenantUser> =>
    Promise.resolve(makeTenant({ ...linkedSecondaryTenant, phone }))
);
const mockBuildSecondaryOccupantMutationResponse = mockAsyncFn(
  (membership: ILeaseTenantMembership) =>
    Promise.resolve({
      contact: {
        effectiveEmail: membership.inviteEmail,
        effectiveName: membership.displayName,
        effectivePhone: membership.contactPhone,
        membershipId: membership.id,
        source: "membership_listed" as const,
        status: membership.status,
        tenantUserId: membership.tenantUserId,
      },
      membership,
    })
);
const mockResolvePrimaryTenantContactForLongStay = mockAsyncFn(
  (lease: ReturnType<typeof makeLease>) =>
    Promise.resolve({
      effectiveEmail: lease.tenantEmail,
      effectiveName: lease.guestName,
      effectivePhone: lease.tenantPhone,
      membershipId: null,
      membershipStatus: null,
      source: "lease" as const,
      tenantUserId: null,
    })
);

mock.module("@/db/lease-tenant-memberships", () => ({
  leaseTenantMembershipsDb: {
    countNonTerminalSecondariesForLease: mockCountNonTerminalSecondariesForLease,
    createListedSecondary: mockCreateListedSecondary,
    findById: mockFindById,
    transitionStatus: mockTransitionStatus,
    updateSecondaryContact: mockUpdateSecondaryContact,
  },
  loadPrimaryMembershipForLease: mockResolvedNull(),
  loadSecondaryMembershipsByLeaseIds: mockAsyncFn(async () => new Map()),
  loadSecondaryOccupancyNamesByLeaseIds: mockAsyncFn(async () => new Map()),
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findById: mockFindTenantById,
    updateName: mockUpdateName,
    updateUnverifiedPhone: mockUpdateUnverifiedPhone,
  },
}));

mock.module("./resolve-secondary-tenant-contacts-service", () => ({
  buildSecondaryOccupantMutationResponse: mockBuildSecondaryOccupantMutationResponse,
}));

mock.module("./lease-primary-tenant-contact-service", () => ({
  resolvePrimaryTenantContactForLongStay: mockResolvePrimaryTenantContactForLongStay,
}));

const mockApplyPendingPortalInviteEmailChange = mockAsyncFn(() => Promise.resolve());

mock.module("./pending-portal-invite-email-change", () => ({
  applyPendingPortalInviteEmailChange: mockApplyPendingPortalInviteEmailChange,
}));

const { createSecondaryOccupant, deleteSecondaryOccupant, updateSecondaryOccupant } =
  await import("./secondary-occupant-service");

describe("createSecondaryOccupant", () => {
  beforeEach(() => {
    mockCountNonTerminalSecondariesForLease.mockReset();
    mockCreateListedSecondary.mockReset();
    mockResolvePrimaryTenantContactForLongStay.mockReset();
    mockResolvePrimaryTenantContactForLongStay.mockImplementation(async (lease) => ({
      effectiveEmail: lease.tenantEmail,
      effectiveName: lease.guestName,
      effectivePhone: lease.tenantPhone,
      membershipId: null,
      membershipStatus: null,
      source: "lease" as const,
      tenantUserId: null,
    }));
    mockCreateListedSecondary.mockImplementation(async () =>
      makeListedMembership({
        contactPhone: "+13055550111",
        displayName: "Secondary Tenant",
        inviteEmail: "secondary@example.com",
      })
    );
  });

  test("creates a listed secondary membership", async () => {
    await createSecondaryOccupant({
      body: {
        email: "secondary@example.com",
        name: "Secondary Tenant",
        phone: "+13055550111",
      },
      invitedBy: "operator-1",
      lease: makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
    });

    expect(mockCreateListedSecondary).toHaveBeenCalledWith({
      contactPhone: "+13055550111",
      displayName: "Secondary Tenant",
      invitedBy: "operator-1",
      inviteEmail: "secondary@example.com",
      leaseId: "lease-1",
    });
  });

  test("creates a listed secondary membership without email", async () => {
    await createSecondaryOccupant({
      body: {
        email: null,
        name: "Secondary Tenant",
        phone: "+13055550111",
      },
      invitedBy: "operator-1",
      lease: makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
    });

    expect(mockCreateListedSecondary).toHaveBeenCalledWith({
      contactPhone: "+13055550111",
      displayName: "Secondary Tenant",
      invitedBy: "operator-1",
      inviteEmail: null,
      leaseId: "lease-1",
    });
  });

  test("rejects invalid email on create", async () => {
    await expect(
      createSecondaryOccupant({
        body: {
          email: "not-an-email",
          name: "Secondary Tenant",
        },
        invitedBy: "operator-1",
        lease: makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+13055550100",
        }),
      })
    ).rejects.toThrow("email must be a valid email address");
  });

  test("rejects when max secondary occupants reached", async () => {
    mockCountNonTerminalSecondariesForLease.mockResolvedValueOnce(MAX_SECONDARY_OCCUPANTS);

    await expect(
      createSecondaryOccupant({
        body: {
          email: "secondary@example.com",
          name: "Secondary Tenant",
        },
        invitedBy: "operator-1",
        lease: makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+13055550100",
        }),
      })
    ).rejects.toMatchObject({ code: LeaseErrorCode.MAX_SECONDARY_OCCUPANTS });
  });

  test("rejects when secondary email matches primary tenant email", async () => {
    await expect(
      createSecondaryOccupant({
        body: {
          email: "Lease@Example.com",
          name: "Secondary Tenant",
        },
        invitedBy: "operator-1",
        lease: makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+13055550100",
        }),
      })
    ).rejects.toMatchObject({ code: LeaseErrorCode.SECONDARY_OCCUPANT_EMAIL_MATCHES_PRIMARY });

    expect(mockCreateListedSecondary).not.toHaveBeenCalled();
  });
});

describe("updateSecondaryOccupant", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockFindTenantById.mockReset();
    mockUpdateSecondaryContact.mockReset();
    mockUpdateName.mockReset();
    mockUpdateUnverifiedPhone.mockReset();
    mockBuildSecondaryOccupantMutationResponse.mockReset();
    mockApplyPendingPortalInviteEmailChange.mockReset();
    mockApplyPendingPortalInviteEmailChange.mockResolvedValue(undefined);
    mockResolvePrimaryTenantContactForLongStay.mockReset();
    mockResolvePrimaryTenantContactForLongStay.mockImplementation(async (lease) => ({
      effectiveEmail: lease.tenantEmail,
      effectiveName: lease.guestName,
      effectivePhone: lease.tenantPhone,
      membershipId: null,
      membershipStatus: null,
      source: "lease" as const,
      tenantUserId: null,
    }));
  });

  test("updates listed membership contact fields", async () => {
    mockFindById.mockResolvedValueOnce(
      makeListedMembership({
        contactPhone: "+13055550111",
        displayName: "Secondary Tenant",
        id: "membership-1",
        inviteEmail: "secondary@example.com",
      })
    );
    mockUpdateSecondaryContact.mockResolvedValueOnce(
      makeMembership({ displayName: "Updated Secondary" })
    );

    await updateSecondaryOccupant({
      body: { name: "Updated Secondary" },
      lease: makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      membershipId: "membership-1",
    });

    expect(mockUpdateSecondaryContact).toHaveBeenCalledWith("membership-1", {
      displayName: "Updated Secondary",
    });
  });

  test("clears email on listed membership update", async () => {
    mockFindById.mockResolvedValueOnce(
      makeListedMembership({
        contactPhone: "+13055550111",
        displayName: "Secondary Tenant",
        id: "membership-1",
        inviteEmail: "secondary@example.com",
      })
    );
    mockUpdateSecondaryContact.mockResolvedValueOnce(makeMembership({ inviteEmail: null }));

    await updateSecondaryOccupant({
      body: { email: null },
      lease: makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      membershipId: "membership-1",
    });

    expect(mockUpdateSecondaryContact).toHaveBeenCalledWith("membership-1", {
      inviteEmail: null,
    });
    expect(mockApplyPendingPortalInviteEmailChange).not.toHaveBeenCalled();
  });

  test("retargets pending invite when secondary email changes", async () => {
    const pending = makeMembership({
      inviteEmail: "old-secondary@example.com",
      role: TenantMembershipRole.SECONDARY,
      status: TenantMembershipStatus.PENDING_INVITE,
      tenantUserId: null,
    });
    mockFindById.mockResolvedValueOnce(pending);
    mockFindById.mockResolvedValueOnce(
      makeMembership({
        ...pending,
        inviteEmail: "new-secondary@example.com",
      })
    );

    await updateSecondaryOccupant({
      body: { email: "new-secondary@example.com" },
      lease: makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      membershipId: "membership-1",
    });

    expect(mockUpdateSecondaryContact).not.toHaveBeenCalled();
    expect(mockApplyPendingPortalInviteEmailChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nextInviteEmail: "new-secondary@example.com",
        previousInviteEmail: "old-secondary@example.com",
      })
    );
  });

  test("clears email then revokes when pending secondary email is cleared", async () => {
    mockFindById.mockResolvedValueOnce(
      makeMembership({
        inviteEmail: "old-secondary@example.com",
        role: TenantMembershipRole.SECONDARY,
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId: "tenant-1",
      })
    );
    mockUpdateSecondaryContact.mockResolvedValueOnce(
      makeMembership({
        inviteEmail: null,
        role: TenantMembershipRole.SECONDARY,
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
      })
    );
    mockFindById.mockResolvedValueOnce(
      makeMembership({
        inviteEmail: null,
        role: TenantMembershipRole.SECONDARY,
        status: TenantMembershipStatus.REVOKED,
      })
    );

    await updateSecondaryOccupant({
      body: { email: null },
      lease: makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      membershipId: "membership-1",
    });

    expect(mockUpdateSecondaryContact).toHaveBeenCalledWith("membership-1", {
      inviteEmail: null,
    });
    expect(mockApplyPendingPortalInviteEmailChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nextInviteEmail: null,
        previousInviteEmail: "old-secondary@example.com",
      })
    );
  });

  test("rejects linked email changes", async () => {
    mockFindById.mockResolvedValueOnce(
      makeMembership({
        role: TenantMembershipRole.SECONDARY,
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
      })
    );
    mockFindTenantById.mockResolvedValueOnce(makeTenant(linkedSecondaryTenant));

    await expect(
      updateSecondaryOccupant({
        body: { email: "other@example.com" },
        lease: makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+13055550100",
        }),
        membershipId: "membership-1",
      })
    ).rejects.toMatchObject({ code: LeaseErrorCode.LINKED_TENANT_CONTACT });
  });

  test("rejects when updated secondary email matches primary tenant email", async () => {
    mockFindById.mockResolvedValueOnce(
      makeListedMembership({
        contactPhone: "+13055550111",
        displayName: "Secondary Tenant",
        id: "membership-1",
        inviteEmail: "secondary@example.com",
      })
    );

    await expect(
      updateSecondaryOccupant({
        body: { email: "lease@example.com" },
        lease: makeLease({
          guestName: "Lease Primary",
          leaseEndDate: "2027-01-01",
          tenantEmail: "lease@example.com",
          tenantPhone: "+13055550100",
        }),
        membershipId: "membership-1",
      })
    ).rejects.toMatchObject({ code: LeaseErrorCode.SECONDARY_OCCUPANT_EMAIL_MATCHES_PRIMARY });

    expect(mockUpdateSecondaryContact).not.toHaveBeenCalled();
  });
});

describe("deleteSecondaryOccupant", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockTransitionStatus.mockReset();
  });

  test("ends listed secondary membership", async () => {
    mockFindById.mockResolvedValueOnce(
      makeListedMembership({
        contactPhone: "+13055550111",
        displayName: "Secondary Tenant",
        id: "membership-1",
        inviteEmail: "secondary@example.com",
      })
    );
    mockTransitionStatus.mockResolvedValueOnce(
      makeMembership({ status: TenantMembershipStatus.ENDED })
    );

    await deleteSecondaryOccupant({
      lease: makeLease({
        guestName: "Lease Primary",
        leaseEndDate: "2027-01-01",
        tenantEmail: "lease@example.com",
        tenantPhone: "+13055550100",
      }),
      membershipId: "membership-1",
    });

    expect(mockTransitionStatus).toHaveBeenCalledWith("membership-1", TenantMembershipStatus.ENDED);
  });
});
