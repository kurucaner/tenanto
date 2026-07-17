import { beforeEach, describe, expect, mock, test } from "bun:test";

import type {
  ILeaseTenantMembership,
  IProperty,
  IPropertyLongStay,
  IPropertyUnit,
  ITenantUser,
  TTenantMembershipStatus,
} from "@/packages/shared";
import {
  PropertyLongStayStatus,
  TenantLeaseListStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
  UnitRentalType,
} from "@/packages/shared";

const mockFindByIdMembership = mock(() => Promise.resolve(null as ILeaseTenantMembership | null));
const mockFindByTokenHash = mock(() => Promise.resolve(null as ILeaseTenantMembership | null));
const mockFindActiveByTenantUserId = mock(() => Promise.resolve([] as ILeaseTenantMembership[]));
const mockFindEndedByTenantUserId = mock(() => Promise.resolve([] as ILeaseTenantMembership[]));
const mockFindPendingAcceptanceByTenantUserId = mock(() =>
  Promise.resolve([] as ILeaseTenantMembership[])
);
const mockLinkTenantUser = mock(
  (_id: string, _tenantUserId: string): Promise<ILeaseTenantMembership | null> =>
    Promise.resolve(null)
);
const mockTransitionStatus = mock(
  (_id: string, _toStatus: TTenantMembershipStatus): Promise<ILeaseTenantMembership | null> =>
    Promise.resolve(null)
);
const mockExpireMembershipIfPastTtl = mock(() =>
  Promise.resolve(null as ILeaseTenantMembership | null)
);
const mockEndAllNonTerminalForLease = mock(() => Promise.resolve([] as ILeaseTenantMembership[]));
const mockFindByIdLease = mock(() => Promise.resolve(null as IPropertyLongStay | null));
const mockFindByIdProperty = mock(() => Promise.resolve(null as IProperty | null));
const mockFindByIdUnit = mock(() => Promise.resolve(null as IPropertyUnit | null));
const mockFindTenantById = mock(() => Promise.resolve(null as ITenantUser | null));
const mockSetUnverifiedPhoneIfNull = mock((): Promise<ITenantUser | null> => Promise.resolve(null));

mock.module("@/db/lease-tenant-memberships", () => ({
  DuplicatePortalInviteError: class DuplicatePortalInviteError extends Error {
    membership: ILeaseTenantMembership;
    constructor(membership: ILeaseTenantMembership) {
      super("duplicate");
      this.membership = membership;
    }
  },
  leaseTenantMembershipsDb: {
    endAllNonTerminalForLease: mockEndAllNonTerminalForLease,
    expireMembershipIfPastTtl: mockExpireMembershipIfPastTtl,
    findActiveByTenantUserId: mockFindActiveByTenantUserId,
    findById: mockFindByIdMembership,
    findByInviteToken: mockFindByTokenHash,
    findEndedByTenantUserId: mockFindEndedByTenantUserId,
    findPendingAcceptanceByTenantUserId: mockFindPendingAcceptanceByTenantUserId,
    linkTenantUser: mockLinkTenantUser,
    transitionStatus: mockTransitionStatus,
  },
}));

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: { findById: mockFindByIdLease },
}));

mock.module("@/db/properties", () => ({
  propertiesDb: { findById: mockFindByIdProperty },
}));

mock.module("@/db/property-units", () => ({
  propertyUnitsDb: { findById: mockFindByIdUnit },
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findById: mockFindTenantById,
    setUnverifiedPhoneIfNull: mockSetUnverifiedPhoneIfNull,
  },
}));

const { tenantPortalMembershipService } = await import("./tenant-portal-membership-service");

function makeTenant(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "jane@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Jane Tenant",
    phone: null,
    phoneVerifiedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Jane Tenant",
    endedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
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
    tenantPhone: null,
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProperty(overrides: Partial<IProperty> = {}): IProperty {
  return {
    address: "123 Main",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "operator-1",
    favoritedAt: null,
    id: "property-1",
    isFavorite: false,
    legalName: null,
    memberCount: 1,
    name: "Oak Apartments",
    phoneNumber: null,
    unitCount: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeUnit(overrides: Partial<IPropertyUnit> = {}): IPropertyUnit {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    id: "unit-1",
    isDeleted: false,
    layout: "1BR",
    propertyId: "property-1",
    rentalType: UnitRentalType.LONG_TERM,
    unitNumber: "101",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("tenant portal happy path (Phase 1.3)", () => {
  beforeEach(() => {
    mockFindByIdMembership.mockReset();
    mockFindByTokenHash.mockReset();
    mockFindActiveByTenantUserId.mockReset();
    mockFindEndedByTenantUserId.mockReset();
    mockFindPendingAcceptanceByTenantUserId.mockReset();
    mockLinkTenantUser.mockReset();
    mockTransitionStatus.mockReset();
    mockExpireMembershipIfPastTtl.mockReset();
    mockEndAllNonTerminalForLease.mockReset();
    mockFindByIdLease.mockReset();
    mockFindByIdProperty.mockReset();
    mockFindByIdUnit.mockReset();
    mockFindTenantById.mockReset();
    mockSetUnverifiedPhoneIfNull.mockReset();

    mockFindByIdLease.mockResolvedValue(makeLease());
    mockFindByIdProperty.mockResolvedValue(makeProperty());
    mockFindByIdUnit.mockResolvedValue(makeUnit());
    mockFindTenantById.mockResolvedValue(makeTenant());
    mockExpireMembershipIfPastTtl.mockResolvedValue(null);

    mockLinkTenantUser.mockImplementation(async (_id, _tenantUserId) =>
      makeMembership({ tenantUserId: "tenant-1" })
    );
    mockTransitionStatus.mockImplementation(async (id, status) =>
      makeMembership({
        acceptedAt: status === TenantMembershipStatus.ACTIVE ? "2026-01-02T00:00:00.000Z" : null,
        id: typeof id === "string" ? id : "membership-1",
        status,
        tenantUserId: "tenant-1",
      })
    );
  });

  test("new email: pending_invite → redeem after register → active lease listed", async () => {
    const token = "magic-link-token";
    const pending = makeMembership({
      status: TenantMembershipStatus.PENDING_INVITE,
      tenantUserId: null,
    });
    mockFindByTokenHash.mockResolvedValue(pending);

    const tenant = makeTenant();
    const accepted = await tenantPortalMembershipService.redeemInvite(token, tenant);

    expect(mockFindByTokenHash).toHaveBeenCalledWith(token);
    expect(mockLinkTenantUser).toHaveBeenCalledWith("membership-1", "tenant-1");
    expect(mockTransitionStatus).toHaveBeenCalledWith(
      "membership-1",
      TenantMembershipStatus.ACTIVE
    );
    expect(accepted.status).toBe(TenantMembershipStatus.ACTIVE);

    mockFindActiveByTenantUserId.mockResolvedValue([
      makeMembership({ status: TenantMembershipStatus.ACTIVE, tenantUserId: "tenant-1" }),
    ]);
    const leases = await tenantPortalMembershipService.listLeases(
      "tenant-1",
      TenantLeaseListStatus.ACTIVE
    );
    expect(leases).toHaveLength(1);
    expect(leases[0]?.propertyName).toBe("Oak Apartments");
    expect(leases[0]?.leaseId).toBe("lease-1");
  });

  test("existing email: pending_acceptance → accept → active", async () => {
    const pending = makeMembership({
      status: TenantMembershipStatus.PENDING_ACCEPTANCE,
      tenantUserId: "tenant-1",
    });
    mockFindByIdMembership.mockResolvedValue(pending);

    const accepted = await tenantPortalMembershipService.acceptInvite("membership-1", makeTenant());

    expect(mockLinkTenantUser).not.toHaveBeenCalled();
    expect(mockTransitionStatus).toHaveBeenCalledWith(
      "membership-1",
      TenantMembershipStatus.ACTIVE
    );
    expect(accepted.status).toBe(TenantMembershipStatus.ACTIVE);
  });

  test("second property invite appears in pending list until accepted", async () => {
    mockFindPendingAcceptanceByTenantUserId.mockResolvedValue([
      makeMembership({
        id: "membership-2",
        leaseId: "lease-2",
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId: "tenant-1",
      }),
    ]);
    mockFindByIdLease.mockResolvedValue(makeLease({ id: "lease-2", propertyId: "property-2" }));
    mockFindByIdProperty.mockResolvedValue(makeProperty({ id: "property-2", name: "Maple Homes" }));

    const pending = await tenantPortalMembershipService.listPendingInvites("tenant-1");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.membershipId).toBe("membership-2");
    expect(pending[0]?.leaseId).toBe("lease-2");
  });

  test("end lease marks active and pending memberships as ended", async () => {
    const endedMembership = makeMembership({ status: TenantMembershipStatus.ENDED });
    mockEndAllNonTerminalForLease.mockResolvedValue([
      endedMembership,
      makeMembership({ id: "membership-2", status: TenantMembershipStatus.ENDED }),
    ]);

    const ended = await import("@/db/lease-tenant-memberships").then((mod) =>
      mod.leaseTenantMembershipsDb.endAllNonTerminalForLease("lease-1")
    );

    expect(mockEndAllNonTerminalForLease).toHaveBeenCalledWith("lease-1");
    expect(ended.every((row) => row.status === TenantMembershipStatus.ENDED)).toBe(true);

    mockFindActiveByTenantUserId.mockResolvedValue([]);
    mockFindEndedByTenantUserId.mockResolvedValue([endedMembership]);

    const activeLeases = await tenantPortalMembershipService.listLeases(
      "tenant-1",
      TenantLeaseListStatus.ACTIVE
    );
    const pastLeases = await tenantPortalMembershipService.listLeases(
      "tenant-1",
      TenantLeaseListStatus.ENDED
    );

    expect(activeLeases).toHaveLength(0);
    expect(pastLeases).toHaveLength(1);
    expect(pastLeases[0]?.leaseId).toBe("lease-1");
    expect(pastLeases[0]?.status).toBe(TenantMembershipStatus.ENDED);
  });

  test("cannot reuse invite token after accept (single-use)", async () => {
    const token = "one-time-token";
    const pending = makeMembership({
      status: TenantMembershipStatus.PENDING_INVITE,
      tenantUserId: null,
    });
    mockFindByTokenHash.mockResolvedValueOnce(pending);
    mockFindByTokenHash.mockResolvedValueOnce(null);

    const tenant = makeTenant();
    const accepted = await tenantPortalMembershipService.redeemInvite(token, tenant);
    expect(accepted.status).toBe(TenantMembershipStatus.ACTIVE);
    expect(mockTransitionStatus).toHaveBeenCalledWith(
      "membership-1",
      TenantMembershipStatus.ACTIVE
    );

    await expect(tenantPortalMembershipService.redeemInvite(token, tenant)).rejects.toThrow(
      "Invalid or expired invite link"
    );
  });

  test("cannot accept declined invite without operator resend", async () => {
    mockFindByIdMembership.mockResolvedValue(
      makeMembership({ status: TenantMembershipStatus.DECLINED })
    );

    await expect(
      tenantPortalMembershipService.acceptInvite("membership-1", makeTenant())
    ).rejects.toThrow("Ask your property manager to resend");
  });

  test("cannot accept when membership is already expired in DB", async () => {
    mockFindByIdMembership.mockResolvedValue(
      makeMembership({ status: TenantMembershipStatus.EXPIRED })
    );

    await expect(
      tenantPortalMembershipService.acceptInvite("membership-1", makeTenant())
    ).rejects.toThrow("Ask your property manager to resend");
  });

  test("cannot accept after operator revoked the invite", async () => {
    mockFindByIdMembership.mockResolvedValue(
      makeMembership({ status: TenantMembershipStatus.REVOKED })
    );

    await expect(
      tenantPortalMembershipService.acceptInvite("membership-1", makeTenant())
    ).rejects.toThrow("This invite is no longer available");
  });

  test("redeem rejects when invite hash was cleared after accept", async () => {
    mockFindByTokenHash.mockResolvedValue(null);

    await expect(
      tenantPortalMembershipService.redeemInvite("stale-token", makeTenant())
    ).rejects.toThrow("Invalid or expired invite link");
  });

  test("syncs lease phone to tenant user on primary accept when user phone is null", async () => {
    mockFindByIdLease.mockResolvedValue(makeLease({ tenantPhone: "+13055550100" }));
    mockFindByIdMembership.mockResolvedValue(
      makeMembership({
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId: "tenant-1",
      })
    );
    mockSetUnverifiedPhoneIfNull.mockResolvedValue(
      makeTenant({ phone: "+13055550100", phoneVerifiedAt: null })
    );

    await tenantPortalMembershipService.acceptInvite("membership-1", makeTenant());

    expect(mockSetUnverifiedPhoneIfNull).toHaveBeenCalledWith("tenant-1", "+13055550100");
  });

  test("does not overwrite existing tenant phone on accept", async () => {
    mockFindByIdLease.mockResolvedValue(makeLease({ tenantPhone: "+13055550100" }));
    mockFindByIdMembership.mockResolvedValue(
      makeMembership({
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId: "tenant-1",
      })
    );

    await tenantPortalMembershipService.acceptInvite(
      "membership-1",
      makeTenant({ phone: "+13055550999", phoneVerifiedAt: "2026-01-01T00:00:00.000Z" })
    );

    expect(mockSetUnverifiedPhoneIfNull).not.toHaveBeenCalled();
  });
});
