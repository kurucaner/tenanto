import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { AppleUserPayload } from "@/auth/apple";
import { AccountError, HttpStatus, type ITenantUser } from "@/packages/shared";

const mockVerifyGoogleToken = mock(() =>
  Promise.resolve({
    email: "tenant@example.com",
    googleId: "google-1",
    name: "Jane Tenant",
  })
);
const mockVerifyAppleToken = mock((): Promise<AppleUserPayload> =>
  Promise.resolve({
    appleId: "apple-1",
    email: "tenant@example.com",
    name: "Jane Tenant",
  })
);

const mockFindOrCreateByGoogle = mock(() =>
  Promise.resolve({ isNewSignup: true, user: makeTenantUser() })
);
const mockFindOrCreateByApple = mock(() =>
  Promise.resolve({ isNewSignup: true, user: makeTenantUser() })
);

type TRateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

const mockIpAllowed = mock((): Promise<TRateLimitResult> => Promise.resolve({ allowed: true }));
const mockEmailAllowed = mock((): Promise<TRateLimitResult> => Promise.resolve({ allowed: true }));

const mockIssueTenantSession = mock(() =>
  Promise.resolve({
    accessToken: "tenant-access",
    refreshToken: "tenant-refresh",
    user: makeTenantUser(),
  })
);

function makeTenantUser(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "tenant@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Jane Tenant",
    phone: null,
    phoneVerifiedAt: null,
    smsConsentedAt: null,
    smsOptedOutAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

mock.module("@/auth/google", () => ({
  verifyGoogleToken: mockVerifyGoogleToken,
}));

mock.module("@/auth/apple", () => ({
  verifyAppleToken: mockVerifyAppleToken,
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findOrCreateByApple: mockFindOrCreateByApple,
    findOrCreateByGoogle: mockFindOrCreateByGoogle,
  },
}));

mock.module("@/services/tenant-auth-rate-limit", () => ({
  assertTenantAuthEmailAttemptAllowed: mockEmailAllowed,
  assertTenantAuthIpAttemptAllowed: mockIpAllowed,
  getTenantAuthRateLimitErrorMessage: () => "rate limited",
}));

mock.module("@/services/tenant-auth-service", () => ({
  issueTenantSession: mockIssueTenantSession,
}));

const { authenticateTenantWithApple, authenticateTenantWithGoogle } =
  await import("./tenant-social-auth-service");

const mockServer = {} as import("fastify").FastifyInstance;

describe("authenticateTenantWithGoogle", () => {
  beforeEach(() => {
    mockVerifyGoogleToken.mockClear();
    mockFindOrCreateByGoogle.mockClear();
    mockIpAllowed.mockClear();
    mockEmailAllowed.mockClear();
    mockIssueTenantSession.mockClear();
    mockIpAllowed.mockResolvedValue({ allowed: true });
    mockEmailAllowed.mockResolvedValue({ allowed: true });
    mockVerifyGoogleToken.mockResolvedValue({
      email: "tenant@example.com",
      googleId: "google-1",
      name: "Jane Tenant",
    });
    mockFindOrCreateByGoogle.mockResolvedValue({
      isNewSignup: true,
      user: makeTenantUser(),
    });
    mockIssueTenantSession.mockResolvedValue({
      accessToken: "tenant-access",
      refreshToken: "tenant-refresh",
      user: makeTenantUser(),
    });
  });

  test("issues tenant session on happy path", async () => {
    const result = await authenticateTenantWithGoogle(mockServer, {
      body: { idToken: "valid-token" },
      ip: "127.0.0.1",
      platform: "ios",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.session.accessToken).toBe("tenant-access");
    expect(mockIssueTenantSession).toHaveBeenCalledWith(mockServer, makeTenantUser());
    expect(mockFindOrCreateByGoogle).toHaveBeenCalledWith({
      email: "tenant@example.com",
      googleId: "google-1",
      name: "Jane Tenant",
    });
  });

  test("rejects missing idToken", async () => {
    const result = await authenticateTenantWithGoogle(mockServer, {
      body: { idToken: "  " },
      ip: "127.0.0.1",
      platform: "ios",
    });

    expect(result).toEqual({
      body: { error: "idToken is required" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    });
    expect(mockVerifyGoogleToken).not.toHaveBeenCalled();
  });

  test("rejects invalid Google token", async () => {
    mockVerifyGoogleToken.mockRejectedValue(new Error("Invalid Google token payload"));

    const result = await authenticateTenantWithGoogle(mockServer, {
      body: { idToken: "bad" },
      ip: "127.0.0.1",
      platform: "ios",
    });

    expect(result).toEqual({
      body: { error: "Invalid Google token payload" },
      status: "error",
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  });

  test("maps identity conflict to 409", async () => {
    const conflict = Object.assign(new Error("linked to a different Google account"), {
      code: AccountError.IDENTITY_CONFLICT,
    });
    mockFindOrCreateByGoogle.mockRejectedValue(conflict);

    const result = await authenticateTenantWithGoogle(mockServer, {
      body: { idToken: "valid-token" },
      ip: "127.0.0.1",
      platform: "ios",
    });

    expect(result).toEqual({
      body: {
        code: AccountError.IDENTITY_CONFLICT,
        error: "linked to a different Google account",
      },
      status: "error",
      statusCode: HttpStatus.CONFLICT,
    });
  });

  test("rate limits by IP before verify", async () => {
    mockIpAllowed.mockResolvedValue({ allowed: false, retryAfterSec: 30 });

    const result = await authenticateTenantWithGoogle(mockServer, {
      body: { idToken: "valid-token" },
      ip: "127.0.0.1",
      platform: "ios",
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(mockVerifyGoogleToken).not.toHaveBeenCalled();
  });
});

describe("authenticateTenantWithApple", () => {
  beforeEach(() => {
    mockVerifyAppleToken.mockClear();
    mockFindOrCreateByApple.mockClear();
    mockIpAllowed.mockClear();
    mockEmailAllowed.mockClear();
    mockIssueTenantSession.mockClear();
    mockIpAllowed.mockResolvedValue({ allowed: true });
    mockEmailAllowed.mockResolvedValue({ allowed: true });
    mockVerifyAppleToken.mockResolvedValue({
      appleId: "apple-1",
      email: "tenant@example.com",
      name: "Jane Tenant",
    });
    mockFindOrCreateByApple.mockResolvedValue({
      isNewSignup: true,
      user: makeTenantUser(),
    });
    mockIssueTenantSession.mockResolvedValue({
      accessToken: "tenant-access",
      refreshToken: "tenant-refresh",
      user: makeTenantUser(),
    });
  });

  test("issues tenant session and prefers body name", async () => {
    const result = await authenticateTenantWithApple(mockServer, {
      body: { identityToken: "valid-token", name: "Custom Name" },
      ip: "127.0.0.1",
    });

    expect(result.status).toBe("ok");
    expect(mockFindOrCreateByApple).toHaveBeenCalledWith({
      appleId: "apple-1",
      email: "tenant@example.com",
      name: "Custom Name",
    });
  });

  test("rejects first-time Apple without email", async () => {
    const applePayload: AppleUserPayload = {
      appleId: "apple-1",
      email: null,
      name: "Apple User",
    };
    mockVerifyAppleToken.mockResolvedValue(applePayload);
    mockFindOrCreateByApple.mockRejectedValue(
      new Error("Email required for first-time Apple sign-in")
    );

    const result = await authenticateTenantWithApple(mockServer, {
      body: { identityToken: "valid-token" },
      ip: "127.0.0.1",
    });

    expect(result).toEqual({
      body: { error: "Email required for first-time Apple sign-in" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });
});
