import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IUser } from "@/packages/shared";
import { UserType } from "@/packages/shared";

const mockSignAccessToken = mock(() => "access-token");
const mockGenerateRefreshToken = mock(() => "refresh-token");
const mockHashToken = mock((token: string) => `hash:${token}`);
const mockGetRefreshTokenExpiresAt = mock(() => new Date("2026-02-01T00:00:00.000Z"));
const mockCreateRefreshToken = mock(() => Promise.resolve());

mock.module("@/auth/jwt", () => ({
  generateRefreshToken: mockGenerateRefreshToken,
  getRefreshTokenExpiresAt: mockGetRefreshTokenExpiresAt,
  hashToken: mockHashToken,
  signAccessToken: mockSignAccessToken,
}));

mock.module("@/db/refresh-tokens", () => ({
  refreshTokenDb: {
    create: mockCreateRefreshToken,
  },
}));

const { issuePlatformAccessToken, issuePlatformSession } = await import("./platform-auth-service");

const mockServer = {} as import("fastify").FastifyInstance;

function makeUser(overrides: Partial<IUser> = {}): IUser {
  return {
    appleId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "operator@example.com",
    googleId: null,
    id: "user-1",
    name: "Operator",
    onboardingCompletedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userType: UserType.USER,
    ...overrides,
  };
}

describe("issuePlatformSession", () => {
  beforeEach(() => {
    mockSignAccessToken.mockClear();
    mockGenerateRefreshToken.mockClear();
    mockCreateRefreshToken.mockClear();
  });

  test("issues platform access and refresh tokens", async () => {
    const user = makeUser();
    const session = await issuePlatformSession(mockServer, user);

    expect(mockSignAccessToken).toHaveBeenCalledWith(mockServer, {
      email: user.email,
      userId: user.id,
      userType: user.userType,
    });
    expect(mockCreateRefreshToken).toHaveBeenCalledWith({
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      tokenHash: "hash:refresh-token",
      userId: user.id,
    });
    expect(session).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user,
    });
  });
});

describe("issuePlatformAccessToken", () => {
  beforeEach(() => {
    mockCreateRefreshToken.mockClear();
  });

  test("returns access token only", () => {
    const user = makeUser();
    const response = issuePlatformAccessToken(mockServer, user);

    expect(response).toEqual({
      accessToken: "access-token",
      user,
    });
    expect(mockCreateRefreshToken).not.toHaveBeenCalled();
  });
});
