import { describe, expect, test } from "bun:test";

import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";

import {
  resolveSecondaryPortalMembershipForContact,
  resolveSecondaryTenantContactsForDisplay,
} from "./resolve-secondary-tenant-contacts-for-display";

describe("resolveSecondaryTenantContactsForDisplay", () => {
  const lease = {
    actualEndDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    guestName: "Primary",
    id: "lease-1",
    leaseEndDate: "2026-12-31",
    leaseStartDate: "2026-01-01",
    monthlyRent: 1500,
    propertyId: "property-1",
    secondaryTenants: [
      {
        email: "legacy@example.com",
        name: "Legacy Secondary",
        phone: "+15556667777",
      },
    ],
    status: "active" as const,
    tenantEmail: "primary@example.com",
    tenantPhone: null,
    termMonths: 12,
    unitId: "unit-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  test("prefers API contacts when present", () => {
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

    expect(resolveSecondaryTenantContactsForDisplay(lease, apiContacts)).toEqual(apiContacts);
  });

  test("falls back to legacy JSONB when API contacts are absent", () => {
    expect(resolveSecondaryTenantContactsForDisplay(lease, undefined)).toEqual([
      {
        effectiveEmail: "legacy@example.com",
        effectiveName: "Legacy Secondary",
        effectivePhone: "+15556667777",
        membershipId: null,
        source: "legacy_jsonb",
        status: null,
        tenantUserId: null,
      },
    ]);
  });

  test("falls back to legacy JSONB when API contacts are empty", () => {
    expect(resolveSecondaryTenantContactsForDisplay(lease, [])).toHaveLength(1);
  });
});

describe("resolveSecondaryPortalMembershipForContact", () => {
  test("uses membership id from contact when present", () => {
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

  test("matches legacy JSONB contact by email", () => {
    const membership = {
      acceptedAt: null,
      contactPhone: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      declinedAt: null,
      displayName: "Legacy",
      endedAt: null,
      expiresAt: "2026-02-01T00:00:00.000Z",
      id: "membership-legacy",
      invitedAt: "2026-01-01T00:00:00.000Z",
      invitedBy: "operator-1",
      inviteEmail: "legacy@example.com",
      leaseId: "lease-1",
      revokedAt: null,
      role: TenantMembershipRole.SECONDARY,
      status: TenantMembershipStatus.PENDING_INVITE,
      tenantUserId: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(
      resolveSecondaryPortalMembershipForContact(
        {
          effectiveEmail: "legacy@example.com",
          effectiveName: "Legacy Secondary",
          effectivePhone: null,
          membershipId: null,
          source: "legacy_jsonb",
          status: null,
          tenantUserId: null,
        },
        [membership]
      )?.id
    ).toBe("membership-legacy");
  });
});
