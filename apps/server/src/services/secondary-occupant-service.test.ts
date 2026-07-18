import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership, IPropertyLongStay, ITenantUser } from "@/packages/shared";
import {
  MAX_SECONDARY_OCCUPANTS,
  PropertyLongStayStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "@/packages/shared";

const mockCountNonTerminalSecondariesForLease = mock(() => Promise.resolve(0));
const mockCreateListedSecondary = mock((): Promise<ILeaseTenantMembership> =>
  Promise.resolve(makeMembership())
);
const mockFindById = mock((): Promise<ILeaseTenantMembership | null> => Promise.resolve(null));
const mockTransitionStatus = mock((): Promise<ILeaseTenantMembership | null> => Promise.resolve(null));
const mockUpdateSecondaryContact = mock((): Promise<ILeaseTenantMembership | null> =>
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
const mockBuildSecondaryOccupantMutationResponse = mock(
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

mock.module("@/db/lease-tenant-memberships", () => ({
  DuplicatePortalInviteError: class DuplicatePortalInviteError extends Error {},
  leaseTenantMembershipsDb: {
    countNonTerminalSecondariesForLease: mockCountNonTerminalSecondariesForLease,
    createListedSecondary: mockCreateListedSecondary,
    findById: mockFindById,
    transitionStatus: mockTransitionStatus,
    updateSecondaryContact: mockUpdateSecondaryContact,
  },
  loadPrimaryMembershipForLease: mock(() => Promise.resolve(null)),
  MaxSecondaryOccupantsError: class MaxSecondaryOccupantsError extends Error {},
  SecondaryOccupantNotFoundError: class SecondaryOccupantNotFoundError extends Error {},
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

const {
  createSecondaryOccupant,
  deleteSecondaryOccupant,
  LinkedTenantContactError,
  MaxSecondaryOccupantsError,
  updateSecondaryOccupant,
} = await import("./secondary-occupant-service");

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
    acceptedAt: null,
    contactPhone: "+13055550111",
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Secondary Tenant",
    endedAt: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "secondary@example.com",
    leaseId: "lease-1",
    revokedAt: null,
    role: TenantMembershipRole.SECONDARY,
    status: TenantMembershipStatus.LISTED,
    tenantUserId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTenant(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "linked-secondary@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Linked Secondary",
    phone: "+13055550999",
    phoneVerifiedAt: null,
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("createSecondaryOccupant", () => {
  beforeEach(() => {
    mockCountNonTerminalSecondariesForLease.mockReset();
    mockCreateListedSecondary.mockReset();
    mockCreateListedSecondary.mockImplementation(async () => makeMembership());
  });

  test("creates a listed secondary membership", async () => {
    await createSecondaryOccupant({
      body: {
        email: "secondary@example.com",
        name: "Secondary Tenant",
        phone: "+13055550111",
      },
      invitedBy: "operator-1",
      lease: makeLease(),
    });

    expect(mockCreateListedSecondary).toHaveBeenCalledWith({
      contactPhone: "+13055550111",
      displayName: "Secondary Tenant",
      invitedBy: "operator-1",
      inviteEmail: "secondary@example.com",
      leaseId: "lease-1",
    });
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
        lease: makeLease(),
      })
    ).rejects.toBeInstanceOf(MaxSecondaryOccupantsError);
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
  });

  test("updates listed membership contact fields", async () => {
    mockFindById.mockResolvedValueOnce(makeMembership());
    mockUpdateSecondaryContact.mockResolvedValueOnce(
      makeMembership({ displayName: "Updated Secondary" })
    );

    await updateSecondaryOccupant({
      body: { name: "Updated Secondary" },
      lease: makeLease(),
      membershipId: "membership-1",
    });

    expect(mockUpdateSecondaryContact).toHaveBeenCalledWith("membership-1", {
      displayName: "Updated Secondary",
    });
  });

  test("rejects linked email changes", async () => {
    mockFindById.mockResolvedValueOnce(
      makeMembership({
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
      })
    );
    mockFindTenantById.mockResolvedValueOnce(makeTenant());

    await expect(
      updateSecondaryOccupant({
        body: { email: "other@example.com" },
        lease: makeLease(),
        membershipId: "membership-1",
      })
    ).rejects.toBeInstanceOf(LinkedTenantContactError);
  });
});

describe("deleteSecondaryOccupant", () => {
  beforeEach(() => {
    mockFindById.mockReset();
    mockTransitionStatus.mockReset();
  });

  test("ends listed secondary membership", async () => {
    mockFindById.mockResolvedValueOnce(makeMembership());
    mockTransitionStatus.mockResolvedValueOnce(
      makeMembership({ status: TenantMembershipStatus.ENDED })
    );

    await deleteSecondaryOccupant({
      lease: makeLease(),
      membershipId: "membership-1",
    });

    expect(mockTransitionStatus).toHaveBeenCalledWith(
      "membership-1",
      TenantMembershipStatus.ENDED
    );
  });
});
