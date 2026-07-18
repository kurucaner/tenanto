import { describe, expect, test } from "bun:test";

import {
  canonicalizeJsonbSecondaryTenants,
  planSecondaryTenantBackfillForLease,
  summarizeSecondaryBackfillVerification,
  verifySecondaryTenantBackfillForLease,
} from "./secondary-tenant-membership-backfill";
import {
  type ILeaseTenantMembership,
  TenantMembershipRole,
  TenantMembershipStatus,
} from "./tenant-portal-types";

function makeMembership(overrides: Partial<ILeaseTenantMembership> = {}): ILeaseTenantMembership {
  return {
    acceptedAt: null,
    contactPhone: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    displayName: "Secondary",
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

describe("canonicalizeJsonbSecondaryTenants", () => {
  test("deduplicates JSONB rows by normalized email", () => {
    const result = canonicalizeJsonbSecondaryTenants([
      { email: "dup@example.com", name: "First", phone: null },
      { email: " DUP@Example.com ", name: "Second", phone: null },
    ]);

    expect(result.canonical).toHaveLength(1);
    expect(result.duplicateEmails).toEqual(["dup@example.com"]);
  });
});

describe("planSecondaryTenantBackfillForLease", () => {
  test("inserts listed row for JSONB-only secondary", () => {
    const plan = planSecondaryTenantBackfillForLease({
      jsonbTenants: [{ email: "new@example.com", name: "New Secondary", phone: "+15551112222" }],
      leaseId: "lease-1",
      memberships: [],
    });

    expect(plan.actions.some((action) => action.kind === "insert_listed")).toBe(true);
  });

  test("updates pending membership contact fields from JSONB", () => {
    const plan = planSecondaryTenantBackfillForLease({
      jsonbTenants: [{ email: "pending@example.com", name: "Updated Name", phone: "+15553334444" }],
      leaseId: "lease-1",
      memberships: [
        makeMembership({
          contactPhone: "+15551112222",
          displayName: "Old Name",
          id: "pending-1",
          inviteEmail: "pending@example.com",
          status: TenantMembershipStatus.PENDING_INVITE,
        }),
      ],
    });

    expect(plan.actions).toContainEqual(
      expect.objectContaining({
        displayName: "Updated Name",
        kind: "update_contact",
        membershipId: "pending-1",
      })
    );
  });

  test("skips insert for active linked secondary", () => {
    const plan = planSecondaryTenantBackfillForLease({
      jsonbTenants: [{ email: "linked@example.com", name: "Linked", phone: null }],
      leaseId: "lease-1",
      memberships: [
        makeMembership({
          id: "active-1",
          inviteEmail: "linked@example.com",
          status: TenantMembershipStatus.ACTIVE,
          tenantUserId: "tenant-1",
        }),
      ],
    });

    expect(plan.actions.some((action) => action.kind === "skip_active_linked")).toBe(true);
    expect(plan.actions.some((action) => action.kind === "insert_listed")).toBe(false);
  });

  test("inserts listed row when only terminal membership exists for email", () => {
    const plan = planSecondaryTenantBackfillForLease({
      jsonbTenants: [{ email: "returning@example.com", name: "Returning", phone: null }],
      leaseId: "lease-1",
      memberships: [
        makeMembership({
          inviteEmail: "returning@example.com",
          status: TenantMembershipStatus.ENDED,
        }),
      ],
    });

    expect(plan.actions.some((action) => action.kind === "insert_listed")).toBe(true);
  });
});

describe("verifySecondaryTenantBackfillForLease", () => {
  test("returns null when JSONB and membership email sets match", () => {
    expect(
      verifySecondaryTenantBackfillForLease({
        jsonbTenants: [{ email: "listed@example.com", name: "Listed", phone: null }],
        leaseId: "lease-1",
        memberships: [
          makeMembership({
            inviteEmail: "listed@example.com",
            status: TenantMembershipStatus.LISTED,
          }),
        ],
      })
    ).toBeNull();
  });

  test("reports orphan memberships when JSONB row is missing", () => {
    const gap = verifySecondaryTenantBackfillForLease({
      jsonbTenants: [],
      leaseId: "lease-1",
      memberships: [
        makeMembership({
          inviteEmail: "membership-only@example.com",
          status: TenantMembershipStatus.LISTED,
        }),
      ],
    });

    expect(gap?.orphanMembershipEmails).toEqual(["membership-only@example.com"]);
    expect(
      summarizeSecondaryBackfillVerification(gap ? [gap] : []).ok
    ).toBe(false);
  });
});
