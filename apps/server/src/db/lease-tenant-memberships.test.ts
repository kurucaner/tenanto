import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LeaseErrorCode } from "@/errors/lease-errors";
import type { ILeaseTenantMembership } from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";
import { makeMembership } from "@/test-fixtures/domain";

type MockQueryResult = {
  rowCount: number;
  rows: Record<string, unknown>[];
};

const mockFindById = mock(() => Promise.resolve(null as ILeaseTenantMembership | null));
const mockQuery = mock((): Promise<MockQueryResult> =>
  Promise.resolve({
    rowCount: 1,
    rows: [],
  })
);

mock.module("@/db/pool", () => ({
  pool: {
    query: mockQuery,
  },
}));

const { leaseTenantMembershipsDb } = await import("./lease-tenant-memberships");

describe("leaseTenantMembershipsDb.transitionStatus", () => {
  beforeEach(() => {
    mockFindById.mockClear();
    mockQuery.mockClear();
    leaseTenantMembershipsDb.findById = mockFindById;
  });

  test("rejects invalid status transitions", async () => {
    mockFindById.mockResolvedValueOnce(makeMembership({ status: TenantMembershipStatus.DECLINED }));

    await expect(
      leaseTenantMembershipsDb.transitionStatus("membership-1", TenantMembershipStatus.ACTIVE)
    ).rejects.toMatchObject({ code: LeaseErrorCode.INVALID_TENANT_MEMBERSHIP_TRANSITION });
  });

  test("returns null when membership does not exist", async () => {
    mockFindById.mockResolvedValueOnce(null);

    const result = await leaseTenantMembershipsDb.transitionStatus(
      "missing",
      TenantMembershipStatus.ACTIVE
    );

    expect(result).toBeNull();
  });

  test("clears invite_token_hash when transitioning to active (single-use)", async () => {
    mockFindById.mockResolvedValueOnce(
      makeMembership({ status: TenantMembershipStatus.PENDING_INVITE })
    );
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          accepted_at: new Date("2026-01-02T00:00:00.000Z"),
          created_at: new Date("2026-01-01T00:00:00.000Z"),
          declined_at: null,
          display_name: "Jane Tenant",
          ended_at: null,
          expires_at: new Date("2026-02-01T00:00:00.000Z"),
          id: "membership-1",
          invite_email: "jane@example.com",
          invite_token_hash: null,
          invited_at: new Date("2026-01-01T00:00:00.000Z"),
          invited_by: "operator-1",
          lease_id: "lease-1",
          revoked_at: null,
          role: TenantMembershipRole.PRIMARY,
          status: TenantMembershipStatus.ACTIVE,
          tenant_user_id: "tenant-1",
          updated_at: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
    });

    const result = await leaseTenantMembershipsDb.transitionStatus(
      "membership-1",
      TenantMembershipStatus.ACTIVE
    );

    expect(result?.status).toBe(TenantMembershipStatus.ACTIVE);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("invite_token_hash = NULL"), [
      TenantMembershipStatus.ACTIVE,
      "membership-1",
    ]);
  });
});

describe("leaseTenantMembershipsDb.expirePendingPortalInvites", () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  test("updates pending invites past TTL to expired", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 2, rows: [] });

    const count = await leaseTenantMembershipsDb.expirePendingPortalInvites();

    expect(count).toBe(2);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("expires_at <= NOW()"), [
      TenantMembershipStatus.EXPIRED,
      TenantMembershipStatus.PENDING_INVITE,
      TenantMembershipStatus.PENDING_ACCEPTANCE,
    ]);
  });
});

describe("leaseTenantMembershipsDb.endAllNonTerminalForLease", () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  test("ends active, pending, and listed memberships for a lease", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 2, rows: [] });

    await leaseTenantMembershipsDb.endAllNonTerminalForLease("lease-1");

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("ended_at = NOW()"), [
      TenantMembershipStatus.ENDED,
      "lease-1",
      TenantMembershipStatus.ACTIVE,
      TenantMembershipStatus.PENDING_INVITE,
      TenantMembershipStatus.PENDING_ACCEPTANCE,
      TenantMembershipStatus.LISTED,
    ]);
  });
});

describe("loadSecondaryMembershipsForLease", () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  test("loads non-terminal secondary memberships for a lease", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const { loadSecondaryMembershipsForLease } = await import("./lease-tenant-memberships");
    await loadSecondaryMembershipsForLease("lease-1");

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("lease_id = ANY($1::uuid[])"), [
      ["lease-1"],
      TenantMembershipRole.SECONDARY,
      TenantMembershipStatus.DECLINED,
      TenantMembershipStatus.REVOKED,
      TenantMembershipStatus.ENDED,
      TenantMembershipStatus.EXPIRED,
    ]);
  });
});

describe("loadSecondaryMembershipsByLeaseIds", () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  test("returns empty map for empty lease id list", async () => {
    const { loadSecondaryMembershipsByLeaseIds } = await import("./lease-tenant-memberships");
    await expect(loadSecondaryMembershipsByLeaseIds([])).resolves.toEqual(new Map());
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("loads non-terminal secondary memberships for many leases", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const { loadSecondaryMembershipsByLeaseIds } = await import("./lease-tenant-memberships");
    await loadSecondaryMembershipsByLeaseIds(["lease-1", "lease-2"]);

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("lease_id = ANY($1::uuid[])"), [
      ["lease-1", "lease-2"],
      TenantMembershipRole.SECONDARY,
      TenantMembershipStatus.DECLINED,
      TenantMembershipStatus.REVOKED,
      TenantMembershipStatus.ENDED,
      TenantMembershipStatus.EXPIRED,
    ]);
  });
});

describe("leaseTenantMembershipsDb.expireMembershipIfPastTtl", () => {
  beforeEach(() => {
    mockFindById.mockClear();
    mockQuery.mockClear();
    leaseTenantMembershipsDb.findById = mockFindById;
  });

  test("returns null when invite is still within TTL", async () => {
    const result = await leaseTenantMembershipsDb.expireMembershipIfPastTtl(
      makeMembership({
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        status: TenantMembershipStatus.PENDING_INVITE,
      })
    );

    expect(result).toBeNull();
    expect(mockFindById).not.toHaveBeenCalled();
  });

  test("transitions pending past TTL to expired", async () => {
    const pending = makeMembership({
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
      status: TenantMembershipStatus.PENDING_INVITE,
    });
    mockFindById.mockResolvedValueOnce(pending);
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          accepted_at: null,
          created_at: new Date("2026-01-01T00:00:00.000Z"),
          declined_at: null,
          display_name: "Jane Tenant",
          ended_at: null,
          expires_at: new Date(pending.expiresAt),
          id: pending.id,
          invite_email: pending.inviteEmail,
          invited_at: new Date("2026-01-01T00:00:00.000Z"),
          invited_by: pending.invitedBy,
          lease_id: pending.leaseId,
          revoked_at: null,
          role: pending.role,
          status: TenantMembershipStatus.EXPIRED,
          tenant_user_id: null,
          updated_at: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    const result = await leaseTenantMembershipsDb.expireMembershipIfPastTtl(pending);

    expect(result?.status).toBe(TenantMembershipStatus.EXPIRED);
    expect(mockFindById).toHaveBeenCalledWith(pending.id, expect.anything());
  });
});
