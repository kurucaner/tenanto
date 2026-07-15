import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ITenantUser } from "@/packages/shared";

const mockSignTenantAccessToken = mock(() => "access-token");
const mockGenerateRefreshToken = mock(() => "refresh-token");
const mockHashToken = mock((token: string) => `hash:${token}`);
const mockGetRefreshTokenExpiresAt = mock(() => new Date("2026-02-01T00:00:00.000Z"));
const mockCreateRefreshToken = mock(() => Promise.resolve());
const mockRevokeByHash = mock(() => Promise.resolve());

mock.module("@/auth/tenant-jwt", () => ({
  signTenantAccessToken: mockSignTenantAccessToken,
}));

mock.module("@/auth/jwt", () => ({
  generateRefreshToken: mockGenerateRefreshToken,
  getRefreshTokenExpiresAt: mockGetRefreshTokenExpiresAt,
  hashToken: mockHashToken,
}));

mock.module("@/db/tenant-refresh-tokens", () => ({
  tenantRefreshTokenDb: {
    create: mockCreateRefreshToken,
    revokeByHash: mockRevokeByHash,
  },
}));

const { issueTenantSession, rotateTenantSession } = await import("./tenant-auth-service");

const mockServer = {} as import("fastify").FastifyInstance;

function makeTenantUser(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "tenant@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Jane Tenant",
    phone: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("issueTenantSession", () => {
  beforeEach(() => {
    mockSignTenantAccessToken.mockClear();
    mockGenerateRefreshToken.mockClear();
    mockHashToken.mockClear();
    mockGetRefreshTokenExpiresAt.mockClear();
    mockCreateRefreshToken.mockClear();
  });

  test("issues tenant access and refresh tokens", async () => {
    const user = makeTenantUser();
    const session = await issueTenantSession(mockServer, user);

    expect(mockSignTenantAccessToken).toHaveBeenCalledWith(mockServer, {
      email: user.email,
      tenantUserId: user.id,
    });
    expect(mockCreateRefreshToken).toHaveBeenCalledWith({
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      tenantUserId: user.id,
      tokenHash: "hash:refresh-token",
    });
    expect(session).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user,
    });
  });
});

describe("rotateTenantSession", () => {
  beforeEach(() => {
    mockRevokeByHash.mockClear();
    mockCreateRefreshToken.mockClear();
  });

  test("revokes the previous refresh token before issuing a new session", async () => {
    const user = makeTenantUser();
    const session = await rotateTenantSession(mockServer, user, "old-hash");

    expect(mockRevokeByHash).toHaveBeenCalledWith("old-hash");
    expect(mockCreateRefreshToken).toHaveBeenCalledTimes(1);
    expect(session.refreshToken).toBe("refresh-token");
  });
});
