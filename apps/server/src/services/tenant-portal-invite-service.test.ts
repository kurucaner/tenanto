import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { CreateLeaseTenantMembershipInput } from "@/db/lease-tenant-memberships";
import { duplicatePortalInviteError, PortalInviteErrorCode } from "@/errors/portal-invite-errors";
import type {
  ILeaseSecondaryTenantContact,
  ILeaseTenantMembership,
  IProperty,
  IPropertyLongStay,
  IPropertyUnit,
  ITenantUser,
} from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";
import * as transactionalEmails from "@/ses/transactional-emails";
import { makeLease, makeMembership, makeProperty, makeUnit } from "@/test-fixtures/domain";
import {
  mockAsyncFn,
  mockResolved,
  mockResolvedEmpty,
  mockResolvedNull,
  mockSyncVoid,
} from "@/test-fixtures/mocks";

const mockFindByIdLease = mockResolvedNull<IPropertyLongStay>();
const mockFindByIdProperty = mockResolvedNull<IProperty>();
const mockFindByIdUnit = mockResolvedNull<IPropertyUnit>();
const mockFindByEmail = mockResolvedNull<ITenantUser>();
const mockFindByTokenHash = mockResolvedNull<ILeaseTenantMembership>();
const mockFindByIdMembership = mockResolvedNull<ILeaseTenantMembership>();
const mockCreateMembership = mockAsyncFn(
  (_input: CreateLeaseTenantMembershipInput): Promise<ILeaseTenantMembership> =>
    Promise.resolve(makeMembership({ expiresAt: "2026-02-01T00:00:00.000Z" }))
);
const mockTransitionStatus = mockAsyncFn(
  (_id: string, _status: string): Promise<ILeaseTenantMembership | null> => Promise.resolve(null)
);
const mockUpdateInviteToken = mockAsyncFn(
  (_id: string, _hash: string): Promise<ILeaseTenantMembership | null> => Promise.resolve(null)
);
const mockLinkTenantUser = mockAsyncFn(
  (_id: string, _tenantUserId: string): Promise<ILeaseTenantMembership | null> =>
    Promise.resolve(null)
);
const mockResolveSecondaryContacts = mockAsyncFn(
  (): Promise<ILeaseSecondaryTenantContact[]> => Promise.resolve([])
);
const mockExpireMembershipIfPastTtl = mockResolvedNull<ILeaseTenantMembership>();
const mockExpirePendingPortalInvites = mockResolved(0);
const mockSendNewEmail = mockResolved(true);
const mockSendExistingEmail = mockResolved(true);
const mockWinstonError = mockSyncVoid();

mock.module("@/db/property-long-stays", () => ({
  LongStayNotActiveError: class LongStayNotActiveError extends Error {},
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
  InvalidTenantMembershipTransitionError: class InvalidTenantMembershipTransitionError extends Error {},
  leaseTenantMembershipsDb: {
    create: mockCreateMembership,
    expireMembershipIfPastTtl: mockExpireMembershipIfPastTtl,
    expirePendingPortalInvites: mockExpirePendingPortalInvites,
    findById: mockFindByIdMembership,
    findByInviteToken: mockFindByTokenHash,
    linkTenantUser: mockLinkTenantUser,
    transitionStatus: mockTransitionStatus,
    updateInviteToken: mockUpdateInviteToken,
  },
  loadPrimaryMembershipForLease: mockResolvedNull(),
  loadSecondaryMembershipsForLease: mockResolvedEmpty(),
  MaxSecondaryOccupantsError: class MaxSecondaryOccupantsError extends Error {},
  SecondaryOccupantNotFoundError: class SecondaryOccupantNotFoundError extends Error {},
}));

mock.module("@/services/resolve-secondary-tenant-contacts-service", () => ({
  buildSecondaryOccupantMutationResponse: mockResolvedNull(),
  resolveSecondaryTenantContactsForLongStay: mockResolveSecondaryContacts,
}));

mock.module("@/ses/transactional-emails", () => ({
  ...transactionalEmails,
  sendTenantPortalInviteExistingEmail: mockSendExistingEmail,
  sendTenantPortalInviteNewEmail: mockSendNewEmail,
}));

mock.module("./winston", () => ({
  WinstonLogger: {
    error: mockWinstonError,
    info: mockSyncVoid(),
    warn: mockSyncVoid(),
  },
}));

const { tenantPortalInviteService } = await import("./tenant-portal-invite-service");





describe("tenantPortalInviteService.createInvites", () => {
  const originalTenantAppUrl = process.env.TENANT_APP_URL;

  beforeEach(() => {
    process.env.TENANT_APP_URL = "https://tenant.example.com";
    mockFindByIdLease.mockReset();
    mockFindByIdProperty.mockReset();
    mockFindByIdUnit.mockReset();
    mockFindByEmail.mockReset();
    mockFindByTokenHash.mockReset();
    mockFindByIdMembership.mockReset();
    mockCreateMembership.mockReset();
    mockTransitionStatus.mockReset();
    mockUpdateInviteToken.mockReset();
    mockLinkTenantUser.mockReset();
    mockResolveSecondaryContacts.mockReset();
    mockExpireMembershipIfPastTtl.mockReset();
    mockExpirePendingPortalInvites.mockReset();
    mockSendNewEmail.mockReset();
    mockSendExistingEmail.mockReset();
    mockSendNewEmail.mockResolvedValue(true);
    mockSendExistingEmail.mockResolvedValue(true);

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
      phoneVerifiedAt: null,
      smsConsentedAt: null,
      smsOptedOutAt: null,
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

  test("rejects duplicate pending invite (409 path)", async () => {
    const existing = makeMembership({ status: TenantMembershipStatus.PENDING_INVITE });
    mockCreateMembership.mockImplementation(async () => {
      throw duplicatePortalInviteError(existing);
    });

    await expect(
      tenantPortalInviteService.createInvites({
        invitedBy: "operator-1",
        invitePrimary: true,
        leaseId: "lease-1",
        propertyId: "property-1",
      })
    ).rejects.toMatchObject({ code: PortalInviteErrorCode.DUPLICATE });
  });

  test("transitions listed secondary membership to pending_invite without inserting", async () => {
    const listedSecondary = makeMembership({
      displayName: "Alex Secondary",
      id: "secondary-1",
      inviteEmail: "alex@example.com",
      role: TenantMembershipRole.SECONDARY,
      status: TenantMembershipStatus.LISTED,
    });
    mockFindByIdMembership.mockResolvedValue(listedSecondary);
    mockTransitionStatus.mockImplementation(async (_id, status) =>
      makeMembership({
        ...listedSecondary,
        status: status as ILeaseTenantMembership["status"],
      })
    );
    mockUpdateInviteToken.mockImplementation(async (id) =>
      makeMembership({
        ...listedSecondary,
        id,
        status: TenantMembershipStatus.PENDING_INVITE,
      })
    );

    const results = await tenantPortalInviteService.createInvites({
      invitedBy: "operator-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      secondaryMembershipIds: ["secondary-1"],
    });

    expect(results).toHaveLength(1);
    expect(mockCreateMembership).not.toHaveBeenCalled();
    expect(mockTransitionStatus).toHaveBeenCalledWith(
      "secondary-1",
      TenantMembershipStatus.PENDING_INVITE
    );
    expect(mockUpdateInviteToken).toHaveBeenCalledTimes(1);
    expect(mockSendNewEmail).toHaveBeenCalledTimes(1);
    expect(results[0]?.membership.status).toBe(TenantMembershipStatus.PENDING_INVITE);
  });

  test("transitions listed secondary to pending_acceptance and links tenant user when account exists", async () => {
    const listedSecondary = makeMembership({
      displayName: "Alex Secondary",
      id: "secondary-1",
      inviteEmail: "alex@example.com",
      role: TenantMembershipRole.SECONDARY,
      status: TenantMembershipStatus.LISTED,
    });
    mockFindByEmail.mockResolvedValue({
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "alex@example.com",
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
      id: "tenant-2",
      name: "Alex Secondary",
      phone: null,
      phoneVerifiedAt: null,
      smsConsentedAt: null,
      smsOptedOutAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockFindByIdMembership.mockResolvedValue(listedSecondary);
    mockTransitionStatus.mockImplementation(async (_id, status) =>
      makeMembership({
        ...listedSecondary,
        status: status as ILeaseTenantMembership["status"],
      })
    );
    mockLinkTenantUser.mockImplementation(async (id, tenantUserId) =>
      makeMembership({
        ...listedSecondary,
        id,
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId,
      })
    );
    mockUpdateInviteToken.mockImplementation(async (id) =>
      makeMembership({
        ...listedSecondary,
        id,
        status: TenantMembershipStatus.PENDING_ACCEPTANCE,
        tenantUserId: "tenant-2",
      })
    );

    await tenantPortalInviteService.createInvites({
      invitedBy: "operator-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      secondaryMembershipIds: ["secondary-1"],
    });

    expect(mockTransitionStatus).toHaveBeenCalledWith(
      "secondary-1",
      TenantMembershipStatus.PENDING_ACCEPTANCE
    );
    expect(mockLinkTenantUser).toHaveBeenCalledWith("secondary-1", "tenant-2");
    expect(mockSendExistingEmail).toHaveBeenCalledTimes(1);
  });

  test("rejects duplicate pending secondary invite", async () => {
    mockFindByIdMembership.mockResolvedValue(
      makeMembership({
        id: "secondary-1",
        role: TenantMembershipRole.SECONDARY,
        status: TenantMembershipStatus.PENDING_INVITE,
      })
    );

    await expect(
      tenantPortalInviteService.createInvites({
        invitedBy: "operator-1",
        leaseId: "lease-1",
        propertyId: "property-1",
        secondaryMembershipIds: ["secondary-1"],
      })
    ).rejects.toMatchObject({ code: PortalInviteErrorCode.DUPLICATE });
    expect(mockCreateMembership).not.toHaveBeenCalled();
    expect(mockTransitionStatus).not.toHaveBeenCalled();
  });

  test("returns not found when secondary membership belongs to another lease", async () => {
    mockFindByIdMembership.mockResolvedValue(
      makeMembership({
        id: "secondary-1",
        leaseId: "other-lease",
        role: TenantMembershipRole.SECONDARY,
        status: TenantMembershipStatus.LISTED,
      })
    );

    await expect(
      tenantPortalInviteService.createInvites({
        invitedBy: "operator-1",
        leaseId: "lease-1",
        propertyId: "property-1",
        secondaryMembershipIds: ["secondary-1"],
      })
    ).rejects.toMatchObject({ code: PortalInviteErrorCode.LEASE_MISMATCH });
  });

  test("deprecated secondaryIndexes path transitions existing membership without insert", async () => {
    const listedSecondary = makeMembership({
      displayName: "Alex Secondary",
      id: "secondary-1",
      inviteEmail: "alex@example.com",
      role: TenantMembershipRole.SECONDARY,
      status: TenantMembershipStatus.LISTED,
    });
    mockResolveSecondaryContacts.mockResolvedValue([
      {
        effectiveEmail: "alex@example.com",
        effectiveName: "Alex Secondary",
        effectivePhone: null,
        membershipId: "secondary-1",
        source: "membership_listed",
        status: TenantMembershipStatus.LISTED,
        tenantUserId: null,
      },
    ]);
    mockFindByIdMembership.mockResolvedValue(listedSecondary);
    mockTransitionStatus.mockImplementation(async (_id, status) =>
      makeMembership({
        ...listedSecondary,
        status: status as ILeaseTenantMembership["status"],
      })
    );
    mockUpdateInviteToken.mockImplementation(async (id) =>
      makeMembership({
        ...listedSecondary,
        id,
        status: TenantMembershipStatus.PENDING_INVITE,
      })
    );

    await tenantPortalInviteService.createInvites({
      invitedBy: "operator-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      secondaryIndexes: [0],
    });

    expect(mockResolveSecondaryContacts).toHaveBeenCalledTimes(1);
    expect(mockCreateMembership).not.toHaveBeenCalled();
    expect(mockTransitionStatus).toHaveBeenCalledWith(
      "secondary-1",
      TenantMembershipStatus.PENDING_INVITE
    );
  });
});

describe("tenantPortalInviteService.autoInvitePrimaryOnLeaseCreate", () => {
  const originalTenantAppUrl = process.env.TENANT_APP_URL;

  beforeEach(() => {
    process.env.TENANT_APP_URL = "https://tenant.example.com";
    mockFindByIdLease.mockReset();
    mockFindByIdProperty.mockReset();
    mockFindByIdUnit.mockReset();
    mockFindByEmail.mockReset();
    mockCreateMembership.mockReset();
    mockSendNewEmail.mockReset();
    mockSendExistingEmail.mockReset();
    mockSendNewEmail.mockResolvedValue(true);
    mockSendExistingEmail.mockResolvedValue(true);
    mockWinstonError.mockReset();

    mockFindByIdLease.mockResolvedValue(makeLease());
    mockFindByIdProperty.mockResolvedValue(makeProperty());
    mockFindByIdUnit.mockResolvedValue(makeUnit());
    mockFindByEmail.mockResolvedValue(null);
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

  test("returns null when primary tenant email is missing", async () => {
    const result = await tenantPortalInviteService.autoInvitePrimaryOnLeaseCreate({
      invitedBy: "operator-1",
      lease: makeLease({ tenantEmail: null }),
      propertyId: "property-1",
    });

    expect(result).toBeNull();
    expect(mockCreateMembership).not.toHaveBeenCalled();
  });

  test("returns null when primary tenant email is invalid", async () => {
    const result = await tenantPortalInviteService.autoInvitePrimaryOnLeaseCreate({
      invitedBy: "operator-1",
      lease: makeLease({ tenantEmail: "not-an-email" }),
      propertyId: "property-1",
    });

    expect(result).toBeNull();
    expect(mockCreateMembership).not.toHaveBeenCalled();
  });

  test("creates invite and sends email when primary tenant email is valid", async () => {
    const result = await tenantPortalInviteService.autoInvitePrimaryOnLeaseCreate({
      invitedBy: "operator-1",
      lease: makeLease(),
      propertyId: "property-1",
    });

    expect(result).not.toBeNull();
    expect(mockCreateMembership).toHaveBeenCalledTimes(1);
    expect(mockSendNewEmail).toHaveBeenCalledTimes(1);
    expect(result?.emailSent).toBe(true);
    expect(result?.membership.inviteEmail).toBe("jane@example.com");
  });

  test("returns invite result with emailSent false when SES fails", async () => {
    mockSendNewEmail.mockRejectedValue(new Error("SES unavailable"));

    const result = await tenantPortalInviteService.autoInvitePrimaryOnLeaseCreate({
      invitedBy: "operator-1",
      lease: makeLease(),
      propertyId: "property-1",
    });

    expect(result).not.toBeNull();
    expect(result?.emailSent).toBe(false);
    expect(result?.emailError).toBe("SES unavailable");
    expect(mockCreateMembership).toHaveBeenCalledTimes(1);
  });

  test("returns invite result with emailSent false when tenant email notifications are disabled", async () => {
    mockSendNewEmail.mockResolvedValueOnce(false);

    const result = await tenantPortalInviteService.autoInvitePrimaryOnLeaseCreate({
      invitedBy: "operator-1",
      lease: makeLease(),
      propertyId: "property-1",
    });

    expect(result).not.toBeNull();
    expect(result?.emailSent).toBe(false);
    expect(result?.emailError).toBeUndefined();
    expect(mockCreateMembership).toHaveBeenCalledTimes(1);
  });

  test("returns null and logs when invite creation throws unexpectedly", async () => {
    mockCreateMembership.mockRejectedValue(new Error("Database connection lost"));

    const result = await tenantPortalInviteService.autoInvitePrimaryOnLeaseCreate({
      invitedBy: "operator-1",
      lease: makeLease(),
      propertyId: "property-1",
    });

    expect(result).toBeNull();
    expect(mockWinstonError).toHaveBeenCalledWith(
      "tenant_portal.auto_invite_on_lease_create_failed",
      expect.objectContaining({
        leaseId: "lease-1",
        propertyId: "property-1",
      })
    );
  });
});

describe("tenantPortalInviteService.revokeInvite", () => {
  beforeEach(() => {
    mockFindByIdLease.mockReset();
    mockFindByIdProperty.mockReset();
    mockFindByIdUnit.mockReset();
    mockFindByIdMembership.mockReset();
    mockTransitionStatus.mockReset();

    mockFindByIdLease.mockResolvedValue(makeLease());
    mockFindByIdProperty.mockResolvedValue(makeProperty());
    mockFindByIdUnit.mockResolvedValue(makeUnit());
  });

  test("revokes an active membership", async () => {
    mockFindByIdMembership.mockResolvedValue(
      makeMembership({
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-1",
      })
    );
    mockTransitionStatus.mockResolvedValue(
      makeMembership({
        status: TenantMembershipStatus.REVOKED,
        tenantUserId: "tenant-1",
      })
    );

    const revoked = await tenantPortalInviteService.revokeInvite({
      leaseId: "lease-1",
      membershipId: "membership-1",
      propertyId: "property-1",
    });

    expect(mockTransitionStatus).toHaveBeenCalledWith(
      "membership-1",
      TenantMembershipStatus.REVOKED
    );
    expect(revoked.status).toBe(TenantMembershipStatus.REVOKED);
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

    expect(mockFindByTokenHash).toHaveBeenCalledWith(token);
    expect(preview.summary.propertyName).toBe("Oak Apartments");
    expect(preview.summary.unitLabel).toBe("101 (1BR)");
    expect(preview.hasExistingAccount).toBe(false);
    expect(preview.inviteEmail).toBe("jane@example.com");
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
