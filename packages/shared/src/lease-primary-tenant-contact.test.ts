import { describe, expect, test } from "bun:test";

import {
  type ILeasePrimaryTenantContactLeaseInput,
  resolvePrimaryTenantContact,
  selectPrimaryMembershipForContact,
} from "./lease-primary-tenant-contact";
import {
  type ILeaseTenantMembership,
  type ITenantUser,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "./tenant-portal-types";

function makeLease(
  overrides: Partial<ILeasePrimaryTenantContactLeaseInput> = {}
): ILeasePrimaryTenantContactLeaseInput {
  return {
    guestName: "Lease Primary",
    tenantEmail: "lease@example.com",
    tenantPhone: "+15551234567",
    ...overrides,
  };
}

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Invite Display",
    endedAt: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "invite@example.com",
    leaseId: "lease-1",
    revokedAt: null,
    role: TenantMembershipRole.PRIMARY,
    status: TenantMembershipStatus.PENDING_INVITE,
    tenantUserId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTenantUser(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "linked@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-user-1",
    name: "Linked Tenant",
    phone: "+15559876543",
    phoneVerifiedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectPrimaryMembershipForContact", () => {
  test("prefers active linked primary over pending", () => {
    const active = makeMembership({
      id: "active",
      invitedAt: "2026-01-01T00:00:00.000Z",
      status: TenantMembershipStatus.ACTIVE,
      tenantUserId: "tenant-user-1",
    });
    const pending = makeMembership({
      id: "pending",
      invitedAt: "2026-02-01T00:00:00.000Z",
      status: TenantMembershipStatus.PENDING_INVITE,
    });

    expect(selectPrimaryMembershipForContact([pending, active])?.id).toBe("active");
  });

  test("returns latest pending when no active primary exists", () => {
    const olderPending = makeMembership({
      id: "older-pending",
      invitedAt: "2026-01-01T00:00:00.000Z",
      status: TenantMembershipStatus.PENDING_INVITE,
    });
    const newerPending = makeMembership({
      id: "newer-pending",
      invitedAt: "2026-02-01T00:00:00.000Z",
      status: TenantMembershipStatus.PENDING_ACCEPTANCE,
    });

    expect(selectPrimaryMembershipForContact([olderPending, newerPending])?.id).toBe(
      "newer-pending"
    );
  });

  test("ignores ended primary memberships", () => {
    const ended = makeMembership({
      id: "ended",
      status: TenantMembershipStatus.ENDED,
      tenantUserId: "tenant-user-1",
    });

    expect(selectPrimaryMembershipForContact([ended])).toBeNull();
  });
});

describe("resolvePrimaryTenantContact", () => {
  test("uses linked tenant user for active primary membership", () => {
    const membership = makeMembership({
      status: TenantMembershipStatus.ACTIVE,
      tenantUserId: "tenant-user-1",
    });
    const tenantUser = makeTenantUser();

    expect(
      resolvePrimaryTenantContact({
        lease: makeLease(),
        membership,
        tenantUser,
      })
    ).toEqual({
      effectiveEmail: "linked@example.com",
      effectiveName: "Linked Tenant",
      effectivePhone: "+15559876543",
      membershipId: "membership-1",
      membershipStatus: TenantMembershipStatus.ACTIVE,
      source: "linked_user",
      tenantUserId: "tenant-user-1",
    });
  });

  test("uses membership invite fields and lease phone for pending invite", () => {
    const membership = makeMembership({
      displayName: "Pending Name",
      inviteEmail: "pending@example.com",
      status: TenantMembershipStatus.PENDING_INVITE,
    });

    expect(
      resolvePrimaryTenantContact({
        lease: makeLease({ guestName: "Lease Primary", tenantPhone: "+15551111111" }),
        membership,
        tenantUser: null,
      })
    ).toEqual({
      effectiveEmail: "pending@example.com",
      effectiveName: "Pending Name",
      effectivePhone: "+15551111111",
      membershipId: "membership-1",
      membershipStatus: TenantMembershipStatus.PENDING_INVITE,
      source: "membership_pending",
      tenantUserId: null,
    });
  });

  test("falls back to lease fields when no membership exists", () => {
    expect(
      resolvePrimaryTenantContact({
        lease: makeLease(),
        membership: null,
        tenantUser: null,
      })
    ).toEqual({
      effectiveEmail: "lease@example.com",
      effectiveName: "Lease Primary",
      effectivePhone: "+15551234567",
      membershipId: null,
      membershipStatus: null,
      source: "lease",
      tenantUserId: null,
    });
  });

  test("ignores ended membership and falls back to lease fields", () => {
    const membership = makeMembership({
      status: TenantMembershipStatus.ENDED,
      tenantUserId: "tenant-user-1",
    });

    expect(
      resolvePrimaryTenantContact({
        lease: makeLease(),
        membership,
        tenantUser: makeTenantUser(),
      })
    ).toEqual({
      effectiveEmail: "lease@example.com",
      effectiveName: "Lease Primary",
      effectivePhone: "+15551234567",
      membershipId: null,
      membershipStatus: null,
      source: "lease",
      tenantUserId: null,
    });
  });
});
