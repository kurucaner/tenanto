import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IPropertyInvite, IPropertyMember, IUser } from "@/packages/shared";
import { PropertyInviteStatus, PropertyRole, UserType } from "@/packages/shared";

const mockFindByInviteToken = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockExpireInviteIfPastTtl = mock(() => Promise.resolve(null as IPropertyInvite | null));
const mockFindByEmail = mock(() => Promise.resolve(null as IUser | null));
const mockCreateWithEmail = mock((_input: unknown): Promise<IUser> =>
  Promise.resolve({
    appleId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "invitee@example.com",
    googleId: null,
    id: "user-new",
    name: "Jane Doe",
    onboardingCompletedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userType: UserType.USER,
  })
);
const mockFindOrCreateByGoogle = mock((_input: unknown): Promise<{ user: IUser }> =>
  Promise.resolve({
    user: {
      appleId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "invitee@example.com",
      googleId: "google-1",
      id: "user-google",
      name: "Jane Doe",
      onboardingCompletedAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      userType: UserType.USER,
    },
  })
);
const mockRedeemInvite = mock(
  (_token: string, _user: IUser): Promise<{ invite: IPropertyInvite; member: IPropertyMember }> =>
    Promise.resolve({
      invite: makeInvite({ status: PropertyInviteStatus.ACCEPTED }),
      member: {
        addedBy: "operator-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        id: "member-1",
        propertyId: "property-1",
        role: PropertyRole.MANAGER,
        updatedAt: "2026-01-02T00:00:00.000Z",
        user: {
          email: "invitee@example.com",
          id: "user-new",
          name: "Jane Doe",
        },
        userId: "user-new",
      },
    })
);
const mockIssuePlatformSession = mock(() =>
  Promise.resolve({
    accessToken: "access",
    refreshToken: "refresh",
    user: {
      appleId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "invitee@example.com",
      googleId: null,
      id: "user-new",
      name: "Jane Doe",
      onboardingCompletedAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      userType: UserType.USER,
    },
  })
);
const mockVerifyGoogleToken = mock(() =>
  Promise.resolve({
    email: "invitee@example.com",
    googleId: "google-1",
    name: "Jane Doe",
  })
);

function makeInvite(overrides: Partial<IPropertyInvite> = {}): IPropertyInvite {
  return {
    acceptedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    declinedAt: null,
    email: "invitee@example.com",
    emailError: null,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    id: "invite-1",
    invitedAt: "2026-01-01T00:00:00.000Z",
    invitedBy: "operator-1",
    propertyId: "property-1",
    revokedAt: null,
    role: PropertyRole.MANAGER,
    status: PropertyInviteStatus.PENDING_INVITE,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

mock.module("@/db/property-invites", () => ({
  DuplicatePropertyMemberInviteError: class DuplicatePropertyMemberInviteError extends Error {},
  propertyInvitesDb: {
    expireInviteIfPastTtl: mockExpireInviteIfPastTtl,
    findByInviteToken: mockFindByInviteToken,
  },
}));

mock.module("@/db/users", () => ({
  userDb: {
    createWithEmail: mockCreateWithEmail,
    findByEmail: mockFindByEmail,
    findOrCreateByGoogle: mockFindOrCreateByGoogle,
  },
}));

mock.module("@/services/property-member-invite-action-service", () => ({
  propertyMemberInviteActionService: {
    redeemInvite: mockRedeemInvite,
  },
}));

mock.module("@/services/platform-auth-service", () => ({
  issuePlatformSession: mockIssuePlatformSession,
}));

mock.module("@/auth/google", () => ({
  verifyGoogleToken: mockVerifyGoogleToken,
}));

const { registerPlatformUserWithInviteGoogle, registerPlatformUserWithInvitePassword } =
  await import("./property-member-invite-signup-service");

const fakeServer = {} as import("fastify").FastifyInstance;

describe("registerPlatformUserWithInvitePassword", () => {
  beforeEach(() => {
    mockFindByInviteToken.mockReset();
    mockExpireInviteIfPastTtl.mockReset();
    mockFindByEmail.mockReset();
    mockCreateWithEmail.mockClear();
    mockRedeemInvite.mockClear();
    mockIssuePlatformSession.mockClear();

    mockFindByInviteToken.mockResolvedValue(makeInvite());
    mockExpireInviteIfPastTtl.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
  });

  test("creates user, redeems invite, and returns session", async () => {
    const result = await registerPlatformUserWithInvitePassword(fakeServer, {
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
    expect(mockCreateWithEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "invitee@example.com",
        name: "Jane Doe",
      })
    );
    expect(mockRedeemInvite).toHaveBeenCalled();
    expect(result.response.session?.accessToken).toBe("access");
    expect(result.response.member.userId).toBe("user-new");
  });

  test("returns 409 when account already exists", async () => {
    mockFindByEmail.mockResolvedValue({
      appleId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "invitee@example.com",
      googleId: null,
      id: "user-existing",
      name: "Jane",
      onboardingCompletedAt: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      userType: UserType.USER,
    });

    const result = await registerPlatformUserWithInvitePassword(fakeServer, {
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
    expect(mockCreateWithEmail).not.toHaveBeenCalled();
  });

  test("returns error when invite is expired", async () => {
    const pending = makeInvite({
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    mockFindByInviteToken.mockResolvedValue(pending);
    mockExpireInviteIfPastTtl.mockResolvedValue(
      makeInvite({
        ...pending,
        status: PropertyInviteStatus.EXPIRED,
      })
    );

    const result = await registerPlatformUserWithInvitePassword(fakeServer, {
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
  });
});

describe("registerPlatformUserWithInviteGoogle", () => {
  beforeEach(() => {
    mockFindByInviteToken.mockReset();
    mockExpireInviteIfPastTtl.mockReset();
    mockVerifyGoogleToken.mockReset();
    mockFindOrCreateByGoogle.mockClear();
    mockRedeemInvite.mockClear();
    mockIssuePlatformSession.mockClear();

    mockFindByInviteToken.mockResolvedValue(makeInvite());
    mockExpireInviteIfPastTtl.mockResolvedValue(null);
    mockVerifyGoogleToken.mockResolvedValue({
      email: "invitee@example.com",
      googleId: "google-1",
      name: "Jane Doe",
    });
  });

  test("redeems when Google email matches invite email", async () => {
    const result = await registerPlatformUserWithInviteGoogle(fakeServer, {
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

    const result = await registerPlatformUserWithInviteGoogle(fakeServer, {
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
