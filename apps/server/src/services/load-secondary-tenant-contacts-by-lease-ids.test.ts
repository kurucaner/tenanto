import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership, ITenantUser } from "@/packages/shared";
import { TenantMembershipStatus } from "@/packages/shared";
import { makeListedMembership } from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolvedNull } from "@/test-fixtures/mocks";

const mockLoadSecondaryMembershipsByLeaseIds = mockAsyncFn(() =>
  Promise.resolve(new Map<string, ILeaseTenantMembership[]>())
);
const mockFindTenantUserById = mockResolvedNull<ITenantUser>();

mock.module("@/db/lease-tenant-memberships", () => ({
  loadSecondaryMembershipsByLeaseIds: mockLoadSecondaryMembershipsByLeaseIds,
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findById: mockFindTenantUserById,
  },
}));

const { loadSecondaryTenantContactsByLeaseIds, loadTenantUsersByIdForMemberships } =
  await import("./load-secondary-tenant-contacts-by-lease-ids");

describe("loadSecondaryTenantContactsByLeaseIds", () => {
  beforeEach(() => {
    mockLoadSecondaryMembershipsByLeaseIds.mockReset();
    mockFindTenantUserById.mockReset();
  });

  afterEach(() => {
    mockLoadSecondaryMembershipsByLeaseIds.mockReset();
    mockFindTenantUserById.mockReset();
  });

  test("returns empty map for empty lease id list", async () => {
    await expect(loadSecondaryTenantContactsByLeaseIds([])).resolves.toEqual(new Map());
    expect(mockLoadSecondaryMembershipsByLeaseIds).not.toHaveBeenCalled();
  });

  test("dedupes duplicate lease ids before querying memberships", async () => {
    mockLoadSecondaryMembershipsByLeaseIds.mockResolvedValueOnce(new Map());

    await loadSecondaryTenantContactsByLeaseIds(["lease-1", "lease-1"]);

    expect(mockLoadSecondaryMembershipsByLeaseIds).toHaveBeenCalledWith(["lease-1"]);
  });

  test("resolves listed secondary contacts keyed by lease id", async () => {
    mockLoadSecondaryMembershipsByLeaseIds.mockResolvedValueOnce(
      new Map([["lease-1", [makeListedMembership()]]])
    );

    const contactsByLeaseId = await loadSecondaryTenantContactsByLeaseIds(["lease-1"]);

    expect(contactsByLeaseId.get("lease-1")).toEqual([
      expect.objectContaining({
        effectiveEmail: "listed@example.com",
        effectiveName: "Listed Secondary",
        membershipId: "membership-listed",
        source: "membership_listed",
      }),
    ]);
  });

  test("omits leases with no secondary memberships", async () => {
    mockLoadSecondaryMembershipsByLeaseIds.mockResolvedValueOnce(new Map());

    const contactsByLeaseId = await loadSecondaryTenantContactsByLeaseIds(["lease-1"]);

    expect(contactsByLeaseId.has("lease-1")).toBe(false);
  });

  test("resolves linked active secondary using tenant user email", async () => {
    mockLoadSecondaryMembershipsByLeaseIds.mockResolvedValueOnce(
      new Map([
        [
          "lease-1",
          [
            makeListedMembership({
              id: "membership-active",
              inviteEmail: "invite@example.com",
              status: TenantMembershipStatus.ACTIVE,
              tenantUserId: "tenant-user-1",
            }),
          ],
        ],
      ])
    );
    mockFindTenantUserById.mockResolvedValueOnce({
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "portal@example.com",
      emailVerifiedAt: "2026-01-02T00:00:00.000Z",
      id: "tenant-user-1",
      name: "Portal Secondary",
      phone: "+15559998888",
      phoneVerifiedAt: null,
      smsConsentedAt: null,
      smsOptedOutAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const contactsByLeaseId = await loadSecondaryTenantContactsByLeaseIds(["lease-1"]);

    expect(contactsByLeaseId.get("lease-1")).toEqual([
      expect.objectContaining({
        effectiveEmail: "portal@example.com",
        effectiveName: "Portal Secondary",
        source: "linked_user",
      }),
    ]);
    expect(mockFindTenantUserById).toHaveBeenCalledWith("tenant-user-1");
  });

  test("resolves contacts for multiple leases in one batch", async () => {
    mockLoadSecondaryMembershipsByLeaseIds.mockResolvedValueOnce(
      new Map([
        ["lease-1", [makeListedMembership({ inviteEmail: "one@example.com", leaseId: "lease-1" })]],
        [
          "lease-2",
          [
            makeListedMembership({
              displayName: "Second Lease Secondary",
              id: "membership-2",
              inviteEmail: "two@example.com",
              leaseId: "lease-2",
            }),
          ],
        ],
      ])
    );

    const contactsByLeaseId = await loadSecondaryTenantContactsByLeaseIds(["lease-1", "lease-2"]);

    expect(contactsByLeaseId.get("lease-1")).toEqual([
      expect.objectContaining({ effectiveEmail: "one@example.com" }),
    ]);
    expect(contactsByLeaseId.get("lease-2")).toEqual([
      expect.objectContaining({ effectiveEmail: "two@example.com" }),
    ]);
  });
});

describe("loadTenantUsersByIdForMemberships", () => {
  beforeEach(() => {
    mockFindTenantUserById.mockReset();
  });

  test("dedupes tenant user ids across memberships", async () => {
    mockFindTenantUserById.mockResolvedValue({
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "portal@example.com",
      emailVerifiedAt: null,
      id: "tenant-user-1",
      name: "Portal Secondary",
      phone: null,
      phoneVerifiedAt: null,
      smsConsentedAt: null,
      smsOptedOutAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await loadTenantUsersByIdForMemberships([
      makeListedMembership({ tenantUserId: "tenant-user-1" }),
      makeListedMembership({ id: "membership-2", tenantUserId: "tenant-user-1" }),
    ]);

    expect(mockFindTenantUserById).toHaveBeenCalledTimes(1);
    expect(mockFindTenantUserById).toHaveBeenCalledWith("tenant-user-1");
  });
});
