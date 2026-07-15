import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { CreateLeaseTenantMembershipInput } from "@/db/lease-tenant-memberships";
import type {
  ILeaseTenantMembership,
  IProperty,
  IPropertyLongStay,
  IPropertyUnit,
  ITenantUser,
} from "@/packages/shared";
import {
  PropertyLongStayStatus,
  TenantMembershipRole,
  TenantMembershipStatus,
  UnitRentalType,
} from "@/packages/shared";
import * as transactionalEmails from "@/ses/transactional-emails";

const mockFindByIdLease = mock(() => Promise.resolve(null as IPropertyLongStay | null));
const mockFindByIdProperty = mock(() => Promise.resolve(null as IProperty | null));
const mockFindByIdUnit = mock(() => Promise.resolve(null as IPropertyUnit | null));
const mockFindByEmail = mock(() => Promise.resolve(null as ITenantUser | null));
const mockFindByTokenHash = mock(() => Promise.resolve(null as ILeaseTenantMembership | null));
const mockCreateMembership = mock(
  (_input: CreateLeaseTenantMembershipInput): Promise<ILeaseTenantMembership> =>
    Promise.resolve(makeMembership())
);
const mockExpireMembershipIfPastTtl = mock(() =>
  Promise.resolve(null as ILeaseTenantMembership | null)
);
const mockExpirePendingPortalInvites = mock(() => Promise.resolve(0));
const mockSendNewEmail = mock(() => Promise.resolve());
const mockSendExistingEmail = mock(() => Promise.resolve());

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
  tenantUsersDb: { findByEmail: mockFindByEmail },
}));

mock.module("@/db/lease-tenant-memberships", () => ({
  DuplicatePortalInviteError: class DuplicatePortalInviteError extends Error {
    membership: ILeaseTenantMembership;
    constructor(membership: ILeaseTenantMembership) {
      super("duplicate");
      this.membership = membership;
    }
  },
  leaseTenantMembershipsDb: {
    create: mockCreateMembership,
    expireMembershipIfPastTtl: mockExpireMembershipIfPastTtl,
    expirePendingPortalInvites: mockExpirePendingPortalInvites,
    findByTokenHash: mockFindByTokenHash,
  },
}));

mock.module("@/ses/transactional-emails", () => ({
  ...transactionalEmails,
  sendTenantPortalInviteExistingEmail: mockSendExistingEmail,
  sendTenantPortalInviteNewEmail: mockSendNewEmail,
}));

const { tenantPortalInviteService } = await import("./tenant-portal-invite-service");
const { hashPortalInviteToken } = await import("@/ses/tenant-portal-invite-token");

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

describe("tenantPortalInviteService.createInvites", () => {
  const originalTenantAppUrl = process.env.TENANT_APP_URL;

  beforeEach(() => {
    process.env.TENANT_APP_URL = "https://tenant.example.com";
    mockFindByIdLease.mockReset();
    mockFindByIdProperty.mockReset();
    mockFindByIdUnit.mockReset();
    mockFindByEmail.mockReset();
    mockFindByTokenHash.mockReset();
    mockCreateMembership.mockReset();
    mockExpireMembershipIfPastTtl.mockReset();
    mockExpirePendingPortalInvites.mockReset();
    mockSendNewEmail.mockReset();
    mockSendExistingEmail.mockReset();

    mockFindByIdLease.mockResolvedValue(makeLease());
    mockFindByIdProperty.mockResolvedValue(makeProperty());
    mockFindByIdUnit.mockResolvedValue(makeUnit());
    mockFindByEmail.mockResolvedValue(null);
    mockExpireMembershipIfPastTtl.mockResolvedValue(null);
    mockExpirePendingPortalInvites.mockResolvedValue(0);
    mockCreateMembership.mockImplementation(async (input) =>
      makeMembership({
        inviteEmail: input.inviteEmail,
        status: input.status,
      })
    );
  });

  afterEach(() => {
    if (originalTenantAppUrl === undefined) {
      delete process.env.TENANT_APP_URL;
    } else {
      process.env.TENANT_APP_URL = originalTenantAppUrl;
    }
  });

  test("creates pending_invite membership and sends new-user email when tenant account is absent", async () => {
    const results = await tenantPortalInviteService.createInvites({
      invitedBy: "operator-1",
      invitePrimary: true,
      leaseId: "lease-1",
      propertyId: "property-1",
    });

    expect(results).toHaveLength(1);
    expect(mockCreateMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteEmail: "jane@example.com",
        status: TenantMembershipStatus.PENDING_INVITE,
      })
    );
    expect(mockSendNewEmail).toHaveBeenCalledTimes(1);
    expect(mockSendExistingEmail).not.toHaveBeenCalled();
    expect(results[0]?.emailSent).toBe(true);
  });

  test("creates pending_acceptance membership and sends existing-user email when tenant account exists", async () => {
    mockFindByEmail.mockResolvedValue({
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "jane@example.com",
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
      id: "tenant-1",
      name: "Jane Tenant",
      phone: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const results = await tenantPortalInviteService.createInvites({
      invitedBy: "operator-1",
      invitePrimary: true,
      leaseId: "lease-1",
      propertyId: "property-1",
    });

    expect(mockCreateMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId: "tenant-1",
      })
    );
    expect(mockSendExistingEmail).toHaveBeenCalledTimes(1);
    expect(mockSendNewEmail).not.toHaveBeenCalled();
    expect(results[0]?.emailSent).toBe(true);
  });
});

describe("tenantPortalInviteService.previewInvite", () => {
  beforeEach(() => {
    mockFindByTokenHash.mockReset();
    mockFindByIdLease.mockReset();
    mockFindByIdProperty.mockReset();
    mockFindByIdUnit.mockReset();
    mockFindByEmail.mockReset();

    mockFindByIdLease.mockResolvedValue(makeLease());
    mockFindByIdProperty.mockResolvedValue(makeProperty());
    mockFindByIdUnit.mockResolvedValue(makeUnit());
    mockFindByEmail.mockResolvedValue(null);
  });

  test("returns lease summary for a valid pending invite token", async () => {
    const token = "preview-token";
    mockFindByTokenHash.mockResolvedValue(
      makeMembership({
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        status: TenantMembershipStatus.PENDING_INVITE,
      })
    );

    const preview = await tenantPortalInviteService.previewInvite(token);

    expect(mockFindByTokenHash).toHaveBeenCalledWith(hashPortalInviteToken(token));
    expect(preview.summary.propertyName).toBe("Oak Apartments");
    expect(preview.summary.unitLabel).toBe("101 (1BR)");
    expect(preview.hasExistingAccount).toBe(false);
  });

  test("rejects expired invites", async () => {
    const pending = makeMembership({
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
      status: TenantMembershipStatus.PENDING_INVITE,
    });
    mockFindByTokenHash.mockResolvedValue(pending);
    mockExpireMembershipIfPastTtl.mockResolvedValue(
      makeMembership({
        ...pending,
        status: TenantMembershipStatus.EXPIRED,
      })
    );

    await expect(tenantPortalInviteService.previewInvite("expired")).rejects.toThrow(
      "This invite has expired"
    );
    expect(mockExpireMembershipIfPastTtl).toHaveBeenCalledWith(pending);
  });
});
