import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership } from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";
import {
  mockAsyncFn,
  mockResolved,
  mockResolvedEmpty,
  mockResolvedNull,
  mockSyncVoid,
} from "@/test-fixtures/mocks";

type TBackfillQueryRow =
  | { exists: boolean }
  | {
      created_by: string;
      id: string;
      property_id: string;
      secondary_tenants: Array<{ email: string; name: string; phone: string }>;
    };

const mockQuery = mockAsyncFn((_sql: string): Promise<{ rows: TBackfillQueryRow[] }> =>
  Promise.resolve({
    rows: [{ exists: true }],
  })
);
const mockConnect = mockAsyncFn(() =>
  Promise.resolve({
    query: mockQuery,
    release: mockSyncVoid(),
  })
);
const mockLoadSecondaryMemberships = mockResolvedEmpty<ILeaseTenantMembership>();
const mockCreateListedSecondary = mockResolved({ id: "membership-new" });
const mockUpdateSecondaryContact = mockResolved({ id: "membership-updated" });
const mockSetUnverifiedPhoneIfNull = mockResolvedNull();

mock.module("@/db/pool", () => ({
  pool: {
    connect: mockConnect,
    query: mockResolved({ rows: [] }),
  },
}));

mock.module("@/db/lease-tenant-memberships", () => ({
  InvalidTenantMembershipTransitionError: class InvalidTenantMembershipTransitionError extends Error {},
  leaseTenantMembershipsDb: {
    createListedSecondary: mockCreateListedSecondary,
    updateSecondaryContact: mockUpdateSecondaryContact,
  },
  loadPrimaryMembershipForLease: mockResolvedNull(),
  loadSecondaryMembershipsForLease: mockLoadSecondaryMemberships,
  MaxSecondaryOccupantsError: class MaxSecondaryOccupantsError extends Error {},
  SecondaryOccupantNotFoundError: class SecondaryOccupantNotFoundError extends Error {},
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    setUnverifiedPhoneIfNull: mockSetUnverifiedPhoneIfNull,
  },
}));

const { runSecondaryTenantMembershipBackfill } =
  await import("./secondary-tenant-membership-backfill-service");

describe("runSecondaryTenantMembershipBackfill", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockConnect.mockReset();
    mockLoadSecondaryMemberships.mockReset();
    mockCreateListedSecondary.mockReset();
    mockUpdateSecondaryContact.mockReset();
    mockSetUnverifiedPhoneIfNull.mockReset();

    mockConnect.mockImplementation(() =>
      Promise.resolve({
        query: mockQuery,
        release: mockSyncVoid(),
      })
    );
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("information_schema.columns")) {
        return Promise.resolve({ rows: [{ exists: true }] });
      }
      if (sql.includes("FROM property_long_stays pls")) {
        return Promise.resolve({
          rows: [
            {
              created_by: "operator-1",
              id: "lease-1",
              property_id: "property-1",
              secondary_tenants: [
                {
                  email: "new@example.com",
                  name: "New Secondary",
                  phone: "+15551112222",
                },
              ],
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    mockLoadSecondaryMemberships.mockResolvedValue([]);
  });

  afterEach(() => {
    mockQuery.mockReset();
  });

  test("inserts listed memberships from JSONB in execute mode", async () => {
    let loadCalls = 0;
    mockLoadSecondaryMemberships.mockImplementation(async () => {
      loadCalls += 1;
      if (loadCalls === 1) {
        return [];
      }
      return [
        {
          acceptedAt: null,
          contactPhone: "+15551112222",
          createdAt: "2026-01-01T00:00:00.000Z",
          declinedAt: null,
          displayName: "New Secondary",
          endedAt: null,
          expiresAt: "2099-12-31T23:59:59.000Z",
          id: "membership-new",
          invitedAt: "2026-01-01T00:00:00.000Z",
          invitedBy: "operator-1",
          inviteEmail: "new@example.com",
          leaseId: "lease-1",
          revokedAt: null,
          role: TenantMembershipRole.SECONDARY,
          status: TenantMembershipStatus.LISTED,
          tenantUserId: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ];
    });

    const result = await runSecondaryTenantMembershipBackfill({
      dryRun: false,
      syncPhones: false,
      verifyOnly: false,
    });

    expect(mockCreateListedSecondary).toHaveBeenCalledTimes(1);
    expect(result.counts.inserted).toBe(1);
    expect(result.verification.ok).toBe(true);
  });

  test("does not write in dry-run mode", async () => {
    const result = await runSecondaryTenantMembershipBackfill({
      dryRun: true,
      syncPhones: false,
      verifyOnly: false,
    });

    expect(mockCreateListedSecondary).not.toHaveBeenCalled();
    expect(result.counts.inserted).toBe(1);
  });

  test("verify-only skips writes but reports verification gaps", async () => {
    mockLoadSecondaryMemberships.mockResolvedValue([
      {
        acceptedAt: null,
        contactPhone: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        declinedAt: null,
        displayName: "Orphan",
        endedAt: null,
        expiresAt: "2026-02-01T00:00:00.000Z",
        id: "membership-1",
        invitedAt: "2026-01-01T00:00:00.000Z",
        invitedBy: "operator-1",
        inviteEmail: "orphan@example.com",
        leaseId: "lease-1",
        revokedAt: null,
        role: TenantMembershipRole.SECONDARY,
        status: TenantMembershipStatus.LISTED,
        tenantUserId: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const result = await runSecondaryTenantMembershipBackfill({
      dryRun: true,
      syncPhones: false,
      verifyOnly: true,
    });

    expect(mockCreateListedSecondary).not.toHaveBeenCalled();
    expect(result.verification.ok).toBe(false);
    expect(result.verification.gapCount).toBe(1);
  });
});
