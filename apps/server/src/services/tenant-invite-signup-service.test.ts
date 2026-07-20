import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ILeaseTenantMembership, ITenantUser } from "@/packages/shared";
import { TenantMembershipRole, TenantMembershipStatus } from "@/packages/shared";
import { makeMembership } from "@/test-fixtures/domain";
import { mockAsyncFn, mockResolved, mockResolvedNull } from "@/test-fixtures/mocks";

const mockFindByInviteToken = mockResolvedNull<ILeaseTenantMembership>();
const mockExpireMembershipIfPastTtl = mockResolvedNull<ILeaseTenantMembership>();
const mockFindByEmail = mockResolvedNull<ITenantUser>();
const mockCreateUser = mockAsyncFn((_input: unknown): Promise<ITenantUser> =>
  Promise.resolve({
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "jane@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-new",
    name: "Jane Doe",
    phone: null,
    phoneVerifiedAt: null,
    smsConsentedAt: null,
    smsOptedOutAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
);
const mockFindOrCreateByGoogle = mockAsyncFn((_input: unknown): Promise<{ user: ITenantUser }> =>
  Promise.resolve({
    user: {
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "jane@example.com",
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
      id: "tenant-google",
      name: "Jane Doe",
      phone: null,
      phoneVerifiedAt: null,
      smsConsentedAt: null,
      smsOptedOutAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  })
);
const mockRedeemInvite = mockAsyncFn(
  (_token: string, _user: ITenantUser): Promise<ILeaseTenantMembership> =>
    Promise.resolve({
      acceptedAt: "2026-01-02T00:00:00.000Z",
      contactPhone: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      declinedAt: null,
      displayName: "Jane Doe",
      endedAt: null,
      expiresAt: "2026-02-01T00:00:00.000Z",
      id: "membership-1",
      invitedAt: "2026-01-01T00:00:00.000Z",
      invitedBy: "operator-1",
      inviteEmail: "jane@example.com",
      leaseId: "lease-1",
      revokedAt: null,
      role: TenantMembershipRole.PRIMARY,
      status: TenantMembershipStatus.ACTIVE,
      tenantUserId: "tenant-new",
      updatedAt: "2026-01-02T00:00:00.000Z",
    })
);
const mockIssueTenantSession = mockAsyncFn(() =>
  Promise.resolve({
    accessToken: "access",
    refreshToken: "refresh",
    user: {
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "jane@example.com",
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
      id: "tenant-new",
      name: "Jane Doe",
      phone: null,
      phoneVerifiedAt: null,
      smsConsentedAt: null,
      smsOptedOutAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  })
);
const mockVerifyGoogleToken = mockAsyncFn(() =>
  Promise.resolve({
    email: "jane@example.com",
    googleId: "google-1",
    name: "Jane Doe",
  })
);
const mockIpAllowed = mockResolved({ allowed: true as const });
const mockEmailAllowed = mockResolved({ allowed: true as const });

mock.module("@/db/lease-tenant-memberships", () => ({
  leaseTenantMembershipsDb: {
    expireMembershipIfPastTtl: mockExpireMembershipIfPastTtl,
    findByInviteToken: mockFindByInviteToken,
  },
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    create: mockCreateUser,
    findByEmail: mockFindByEmail,
    findOrCreateByGoogle: mockFindOrCreateByGoogle,
  },
}));

mock.module("@/services/tenant-portal-membership-service", () => ({
  tenantPortalMembershipService: {
    redeemInvite: mockRedeemInvite,
  },
}));

mock.module("@/services/tenant-auth-service", () => ({
  issueTenantSession: mockIssueTenantSession,
}));

mock.module("@/auth/google", () => ({
  verifyGoogleToken: mockVerifyGoogleToken,
}));

mock.module("@/services/tenant-auth-rate-limit", () => ({
  assertTenantAuthEmailAttemptAllowed: mockEmailAllowed,
  assertTenantAuthIpAttemptAllowed: mockIpAllowed,
  getTenantAuthRateLimitErrorMessage: () => "rate limited",
}));

mock.module("@/lib/redis-fixed-window-rate-limit", () => ({
  consumeFixedWindowRateLimit: () => Promise.resolve({ allowed: true }),
}));

const { registerTenantWithInviteGoogle, registerTenantWithInvitePassword } =
  await import("./tenant-invite-signup-service");

const fakeServer = {} as import("fastify").FastifyInstance;

describe("registerTenantWithInvitePassword", () => {
  beforeEach(() => {
    mockFindByInviteToken.mockReset();
    mockExpireMembershipIfPastTtl.mockReset();
    mockFindByEmail.mockReset();
    mockCreateUser.mockClear();
    mockRedeemInvite.mockClear();
    mockIssueTenantSession.mockClear();
    mockIpAllowed.mockClear();
    mockEmailAllowed.mockClear();

    mockFindByInviteToken.mockResolvedValue(makeMembership({ displayName: "Jane Doe" }));
    mockExpireMembershipIfPastTtl.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
    mockIpAllowed.mockResolvedValue({ allowed: true });
    mockEmailAllowed.mockResolvedValue({ allowed: true });
  });

  test("creates verified user, redeems invite, and returns session", async () => {
    const result = await registerTenantWithInvitePassword(fakeServer, {
      body: {
        name: "Jane Doe",
        password: "Password1",
        token: "invite-token",
      },
      ip: "127.0.0.1",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "jane@example.com",
        emailVerifiedAt: expect.any(Date),
        name: "Jane Doe",
      })
    );
    expect(mockRedeemInvite).toHaveBeenCalled();
    expect(result.response.session?.accessToken).toBe("access");
    expect(result.response.membership.status).toBe(TenantMembershipStatus.ACTIVE);
  });

  test("returns 409 when account already exists", async () => {
    mockFindByEmail.mockResolvedValue({
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "jane@example.com",
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
      id: "tenant-existing",
      name: "Jane",
      phone: null,
      phoneVerifiedAt: null,
      smsConsentedAt: null,
      smsOptedOutAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await registerTenantWithInvitePassword(fakeServer, {
      body: {
        name: "Jane Doe",
        password: "Password1",
        token: "invite-token",
      },
      ip: "127.0.0.1",
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") {
      return;
    }
    expect(result.statusCode).toBe(409);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test("returns error when invite is expired", async () => {
    const pending = makeMembership({
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    mockFindByInviteToken.mockResolvedValue(pending);
    mockExpireMembershipIfPastTtl.mockResolvedValue(
      makeMembership({
        ...pending,
        status: TenantMembershipStatus.EXPIRED,
      })
    );

    const result = await registerTenantWithInvitePassword(fakeServer, {
      body: {
        name: "Jane Doe",
        password: "Password1",
        token: "expired-token",
      },
      ip: "127.0.0.1",
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") {
      return;
    }
    expect(result.statusCode).toBe(400);
    expect(result.body.error).toContain("expired");
    expect(result.body.code).toBe("PORTAL_INVITE_INVALID_STATE");
  });
});

describe("registerTenantWithInviteGoogle", () => {
  beforeEach(() => {
    mockFindByInviteToken.mockReset();
    mockExpireMembershipIfPastTtl.mockReset();
    mockVerifyGoogleToken.mockReset();
    mockFindOrCreateByGoogle.mockClear();
    mockRedeemInvite.mockClear();
    mockIssueTenantSession.mockClear();
    mockIpAllowed.mockClear();
    mockEmailAllowed.mockClear();

    mockFindByInviteToken.mockResolvedValue(makeMembership({ displayName: "Jane Doe" }));
    mockExpireMembershipIfPastTtl.mockResolvedValue(null);
    mockVerifyGoogleToken.mockResolvedValue({
      email: "jane@example.com",
      googleId: "google-1",
      name: "Jane Doe",
    });
    mockIpAllowed.mockResolvedValue({ allowed: true });
    mockEmailAllowed.mockResolvedValue({ allowed: true });
  });

  test("redeems when Google email matches invite email", async () => {
    const result = await registerTenantWithInviteGoogle(fakeServer, {
      body: {
        idToken: "google-id-token",
        token: "invite-token",
      },
      ip: "127.0.0.1",
      platform: "ios",
    });

    expect(result.status).toBe("ok");
    expect(mockFindOrCreateByGoogle).toHaveBeenCalled();
    expect(mockRedeemInvite).toHaveBeenCalled();
  });

  test("returns 403 when Google email does not match invite email", async () => {
    mockVerifyGoogleToken.mockResolvedValue({
      email: "other@example.com",
      googleId: "google-2",
      name: "Other",
    });

    const result = await registerTenantWithInviteGoogle(fakeServer, {
      body: {
        idToken: "google-id-token",
        token: "invite-token",
      },
      ip: "127.0.0.1",
      platform: "ios",
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") {
      return;
    }
    expect(result.statusCode).toBe(403);
    expect(mockFindOrCreateByGoogle).not.toHaveBeenCalled();
    expect(mockRedeemInvite).not.toHaveBeenCalled();
  });
});
