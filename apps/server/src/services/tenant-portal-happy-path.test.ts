import { beforeEach, describe, expect, test } from "bun:test";

import { TenantLeaseListStatus, TenantMembershipStatus } from "@/packages/shared";
import { makeLease, makeMembership, makeProperty, makeTenant, makeUnit } from "@/test-fixtures/domain";
import {
  createTenantPortalDbMocks,
  registerTenantPortalDbModules,
  resetMocks,
} from "@/test-fixtures/mocks";

const portalMocks = createTenantPortalDbMocks();
const {
  endAllNonTerminalForLease: mockEndAllNonTerminalForLease,
  expireMembershipIfPastTtl: mockExpireMembershipIfPastTtl,
  findActiveByTenantUserId: mockFindActiveByTenantUserId,
  findByIdLease: mockFindByIdLease,
  findByIdMembership: mockFindByIdMembership,
  findByIdProperty: mockFindByIdProperty,
  findByIdUnit: mockFindByIdUnit,
  findByTokenHash: mockFindByTokenHash,
  findEndedByTenantUserId: mockFindEndedByTenantUserId,
  findPendingAcceptanceByTenantUserId: mockFindPendingAcceptanceByTenantUserId,
  findTenantById: mockFindTenantById,
  linkTenantUser: mockLinkTenantUser,
  setUnverifiedPhoneIfNull: mockSetUnverifiedPhoneIfNull,
  transitionStatus: mockTransitionStatus,
} = portalMocks;

registerTenantPortalDbModules(portalMocks);

const { tenantPortalMembershipService } = await import("./tenant-portal-membership-service");

describe("tenant portal happy path (Phase 1.3)", () => {
  beforeEach(() => {
    resetMocks(
      mockFindByIdMembership,
      mockFindByTokenHash,
      mockFindActiveByTenantUserId,
      mockFindEndedByTenantUserId,
      mockFindPendingAcceptanceByTenantUserId,
      mockLinkTenantUser,
      mockTransitionStatus,
      mockExpireMembershipIfPastTtl,
      mockEndAllNonTerminalForLease,
      mockFindByIdLease,
      mockFindByIdProperty,
      mockFindByIdUnit,
      mockFindTenantById,
      mockSetUnverifiedPhoneIfNull
    );

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
