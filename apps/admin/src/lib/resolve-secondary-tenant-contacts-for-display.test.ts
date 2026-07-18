import { describe, expect, test } from "bun:test";

import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";

import {
  getSecondaryPortalActingMembershipId,
  resolveSecondaryPortalMembershipForContact,
  resolveSecondaryTenantContactsForDisplay,
} from "./resolve-secondary-tenant-contacts-for-display";

describe("resolveSecondaryTenantContactsForDisplay", () => {
  test("returns API contacts when present", () => {
    const apiContacts = [
      {
        effectiveEmail: "listed@example.com",
        effectiveName: "Listed Secondary",
        effectivePhone: null,
        membershipId: "membership-1",
        source: "membership_listed" as const,
        status: TenantMembershipStatus.LISTED,
        tenantUserId: null,
      },
    ];

    expect(resolveSecondaryTenantContactsForDisplay(apiContacts)).toEqual(apiContacts);
  });

  test("returns empty array when API contacts are absent", () => {
    expect(resolveSecondaryTenantContactsForDisplay(undefined)).toEqual([]);
  });

  test("returns empty array when API contacts are empty", () => {
    expect(resolveSecondaryTenantContactsForDisplay([])).toEqual([]);
  });
});

describe("resolveSecondaryPortalMembershipForContact", () => {
  const membership = {
    acceptedAt: null,
    contactPhone: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Alex",
    endedAt: null,
    expiresAt: "2026-02-01T00:00:00.000Z",
    id: "membership-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    inviteEmail: "alex@example.com",
    leaseId: "lease-1",
    revokedAt: null,
    role: TenantMembershipRole.SECONDARY,
    status: TenantMembershipStatus.PENDING_INVITE,
    tenantUserId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  test("finds membership by contact membership id", () => {
    expect(
      resolveSecondaryPortalMembershipForContact(
        {
          effectiveEmail: "alex@example.com",
          effectiveName: "Alex",
          effectivePhone: null,
          membershipId: "membership-1",
          source: "membership_pending",
          status: TenantMembershipStatus.PENDING_INVITE,
          tenantUserId: null,
        },
        [membership]
      )
    ).toEqual(membership);
  });

  test("returns null when contact has no membership id", () => {
    expect(
      resolveSecondaryPortalMembershipForContact(
        {
          effectiveEmail: "alex@example.com",
          effectiveName: "Alex",
          effectivePhone: null,
          membershipId: null,
          source: "membership_listed",
          status: TenantMembershipStatus.LISTED,
          tenantUserId: null,
        },
        [membership]
      )
    ).toBeNull();
  });
});

describe("getSecondaryPortalActingMembershipId", () => {
  test("returns contact membership id", () => {
    expect(
      getSecondaryPortalActingMembershipId({
        effectiveEmail: "listed@example.com",
        effectiveName: "Listed Secondary",
        effectivePhone: null,
        membershipId: "membership-1",
        source: "membership_listed",
        status: TenantMembershipStatus.LISTED,
        tenantUserId: null,
      })
    ).toBe("membership-1");
  });

  test("throws when contact has no membership id", () => {
    expect(() =>
      getSecondaryPortalActingMembershipId({
        effectiveEmail: "listed@example.com",
        effectiveName: "Listed Secondary",
        effectivePhone: null,
        membershipId: null,
        source: "membership_listed",
        status: TenantMembershipStatus.LISTED,
        tenantUserId: null,
      })
    ).toThrow("Secondary tenant contact is missing membership id");
  });
});
