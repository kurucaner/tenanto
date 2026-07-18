import { describe, expect, test } from "bun:test";

import {
  resolveSecondaryTenantContact,
  resolveSecondaryTenantContactsForLease,
  selectSecondaryMembershipForContact,
} from "./lease-secondary-tenant-contact";
import {
  type ILeaseTenantMembership,
  type ITenantUser,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "./tenant-portal-types";

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: null,
    contactPhone: "+15551112222",
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Secondary Display",
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

function makeTenantUser(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "linked-secondary@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-user-1",
    name: "Linked Secondary",
    phone: "+15559998888",
    phoneVerifiedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectSecondaryMembershipForContact", () => {
  test("finds non-terminal secondary membership by normalized email", () => {
    const listed = makeMembership({ id: "listed", status: TenantMembershipStatus.LISTED });
    const ended = makeMembership({
      id: "ended",
      inviteEmail: "secondary@example.com",
      status: TenantMembershipStatus.ENDED,
    });

    expect(selectSecondaryMembershipForContact([listed, ended], " Secondary@Example.com ")).toEqual(
      listed
    );
  });

  test("ignores primary memberships", () => {
    const primary = makeMembership({
      id: "primary",
      role: TenantMembershipRole.PRIMARY,
      status: TenantMembershipStatus.PENDING_INVITE,
    });

    expect(selectSecondaryMembershipForContact([primary], "secondary@example.com")).toBeNull();
  });
});

describe("resolveSecondaryTenantContact", () => {
  test("uses linked tenant user for active secondary membership", () => {
    const membership = makeMembership({
      status: TenantMembershipStatus.ACTIVE,
      tenantUserId: "tenant-user-1",
    });

    expect(resolveSecondaryTenantContact(membership, makeTenantUser())).toEqual({
      effectiveEmail: "linked-secondary@example.com",
      effectiveName: "Linked Secondary",
      effectivePhone: "+15559998888",
      membershipId: "membership-1",
      source: "linked_user",
      status: TenantMembershipStatus.ACTIVE,
      tenantUserId: "tenant-user-1",
    });
  });

  test("uses membership contact fields for listed secondary", () => {
    const membership = makeMembership({
      contactPhone: "+15553334444",
      displayName: "Listed Secondary",
      inviteEmail: "listed@example.com",
      status: TenantMembershipStatus.LISTED,
    });

    expect(resolveSecondaryTenantContact(membership, null)).toEqual({
      effectiveEmail: "listed@example.com",
      effectiveName: "Listed Secondary",
      effectivePhone: "+15553334444",
      membershipId: "membership-1",
      source: "membership_listed",
      status: TenantMembershipStatus.LISTED,
      tenantUserId: null,
    });
  });

  test("uses membership contact fields for listed secondary without email", () => {
    const membership = makeMembership({
      contactPhone: "+15553334444",
      displayName: "Listed Secondary",
      inviteEmail: null,
      status: TenantMembershipStatus.LISTED,
    });

    expect(resolveSecondaryTenantContact(membership, null)).toEqual({
      effectiveEmail: null,
      effectiveName: "Listed Secondary",
      effectivePhone: "+15553334444",
      membershipId: "membership-1",
      source: "membership_listed",
      status: TenantMembershipStatus.LISTED,
      tenantUserId: null,
    });
  });

  test("uses membership contact fields for pending invite", () => {
    const membership = makeMembership({
      contactPhone: "+15554445555",
      displayName: "Pending Secondary",
      inviteEmail: "pending@example.com",
      status: TenantMembershipStatus.PENDING_INVITE,
    });

    expect(resolveSecondaryTenantContact(membership, null)).toEqual({
      effectiveEmail: "pending@example.com",
      effectiveName: "Pending Secondary",
      effectivePhone: "+15554445555",
      membershipId: "membership-1",
      source: "membership_pending",
      status: TenantMembershipStatus.PENDING_INVITE,
      tenantUserId: null,
    });
  });

  test("returns null for terminal secondary membership", () => {
    expect(
      resolveSecondaryTenantContact(makeMembership({ status: TenantMembershipStatus.ENDED }), null)
    ).toBeNull();
  });
});

describe("resolveSecondaryTenantContactsForLease", () => {
  test("resolves contacts from non-terminal secondary memberships", () => {
    const listed = makeMembership({
      id: "listed",
      inviteEmail: "listed@example.com",
      status: TenantMembershipStatus.LISTED,
    });
    const active = makeMembership({
      id: "active",
      inviteEmail: "active@example.com",
      status: TenantMembershipStatus.ACTIVE,
      tenantUserId: "tenant-user-1",
    });

    expect(
      resolveSecondaryTenantContactsForLease({
        memberships: [listed, active],
        tenantUsersById: {
          "tenant-user-1": makeTenantUser({ email: "linked@example.com" }),
        },
      })
    ).toEqual([
      {
        effectiveEmail: "listed@example.com",
        effectiveName: "Secondary Display",
        effectivePhone: "+15551112222",
        membershipId: "listed",
        source: "membership_listed",
        status: TenantMembershipStatus.LISTED,
        tenantUserId: null,
      },
      {
        effectiveEmail: "linked@example.com",
        effectiveName: "Linked Secondary",
        effectivePhone: "+15559998888",
        membershipId: "active",
        source: "linked_user",
        status: TenantMembershipStatus.ACTIVE,
        tenantUserId: "tenant-user-1",
      },
    ]);
  });
});
