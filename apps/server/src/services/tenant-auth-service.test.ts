import { beforeEach, describe, expect, mock, test } from "bun:test";

import { makeTenantUser } from "@/test-fixtures/domain";
import { mockResolvedVoid } from "@/test-fixtures/mocks";

const mockSignTenantAccessToken = mock(() => "access-token");
const mockGenerateRefreshToken = mock(() => "refresh-token");
const mockHashToken = mock((token: string) => `hash:${token}`);
const mockGetRefreshTokenExpiresAt = mock(() => new Date("2026-02-01T00:00:00.000Z"));
const mockCreateRefreshToken = mockResolvedVoid();

mock.module("@/auth/tenant-jwt", () => ({
  signTenantAccessToken: mockSignTenantAccessToken,
}));

mock.module("@/auth/jwt", () => ({
  generateRefreshToken: mockGenerateRefreshToken,
  getRefreshTokenExpiresAt: mockGetRefreshTokenExpiresAt,
  hashToken: mockHashToken,
  signAccessToken: mock(() => "unused"),
}));

mock.module("@/db/tenant-refresh-tokens", () => ({
  tenantRefreshTokenDb: {
    create: mockCreateRefreshToken,
  },
}));

const { issueTenantAccessToken, issueTenantSession } = await import("./tenant-auth-service");

const mockServer = {} as import("fastify").FastifyInstance;


describe("issueTenantSession", () => {
  beforeEach(() => {
    mockSignTenantAccessToken.mockClear();
    mockGenerateRefreshToken.mockClear();
    mockCreateRefreshToken.mockClear();
  });

  test("issues tenant access and refresh tokens with tenant user claims", async () => {
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

describe("issueTenantAccessToken", () => {
  beforeEach(() => {
    mockCreateRefreshToken.mockClear();
  });

  test("returns access token only", () => {
    const user = makeTenantUser();
    const response = issueTenantAccessToken(mockServer, user);

    expect(response).toEqual({
      accessToken: "access-token",
      user,
    });
    expect(mockCreateRefreshToken).not.toHaveBeenCalled();
  });
});
