import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createIdentityConflictError } from "@/constants/account";
import { AccountError, type ITenantUser } from "@/packages/shared";

import { type CreateTenantUserInput, tenantUsersDb } from "./tenant-users";

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

/** Minimal store shape for exercising findOrCreate* via `this`. */
type TOauthStubDb = {
  create: ReturnType<typeof mock<(input: CreateTenantUserInput) => Promise<ITenantUser>>>;
  findByAppleId: ReturnType<typeof mock<(appleId: string) => Promise<ITenantUser | null>>>;
  findByEmail: ReturnType<typeof mock<(email: string) => Promise<ITenantUser | null>>>;
  findByGoogleId: ReturnType<typeof mock<(googleId: string) => Promise<ITenantUser | null>>>;
  findOrCreateByApple: typeof tenantUsersDb.findOrCreateByApple;
  findOrCreateByGoogle: typeof tenantUsersDb.findOrCreateByGoogle;
  linkAppleId: ReturnType<
    typeof mock<(tenantUserId: string, appleId: string) => Promise<ITenantUser>>
  >;
  linkGoogleId: ReturnType<
    typeof mock<(tenantUserId: string, googleId: string) => Promise<ITenantUser>>
  >;
};

function createStubDb(): TOauthStubDb {
  const stub: TOauthStubDb = {
    create: mock((_input: CreateTenantUserInput) =>
      Promise.resolve(makeTenantUser({ id: "tenant-new" }))
    ),
    findByAppleId: mock((_appleId: string) => Promise.resolve(null as ITenantUser | null)),
    findByEmail: mock((_email: string) => Promise.resolve(null as ITenantUser | null)),
    findByGoogleId: mock((_googleId: string) => Promise.resolve(null as ITenantUser | null)),
    findOrCreateByApple: tenantUsersDb.findOrCreateByApple,
    findOrCreateByGoogle: tenantUsersDb.findOrCreateByGoogle,
    linkAppleId: mock((_tenantUserId: string, _appleId: string) =>
      Promise.resolve(makeTenantUser())
    ),
    linkGoogleId: mock((_tenantUserId: string, _googleId: string) =>
      Promise.resolve(makeTenantUser())
    ),
  };

  return stub;
}

describe("tenantUsersDb.findOrCreateByGoogle", () => {
  let stub: TOauthStubDb;

  beforeEach(() => {
    stub = createStubDb();
  });

  test("returns existing Google user", async () => {
    const existing = makeTenantUser({ id: "existing" });
    stub.findByGoogleId.mockResolvedValue(existing);

    const result = await stub.findOrCreateByGoogle({
      email: "tenant@example.com",
      googleId: "google-1",
      name: "Jane",
    });

    expect(result).toEqual({ user: existing });
    expect(stub.create).not.toHaveBeenCalled();
  });

  test("links Google to email match", async () => {
    const byEmail = makeTenantUser({ id: "email-user" });
    stub.findByEmail.mockResolvedValue(byEmail);
    stub.linkGoogleId.mockResolvedValue(byEmail);

    const result = await stub.findOrCreateByGoogle({
      email: "tenant@example.com",
      googleId: "google-1",
      name: "Jane",
    });

    expect(stub.linkGoogleId).toHaveBeenCalledWith("email-user", "google-1");
    expect(result).toEqual({ accountLinked: true, user: byEmail });
  });

  test("creates new social user", async () => {
    const created = makeTenantUser({ id: "tenant-new" });
    stub.create.mockResolvedValue(created);

    const result = await stub.findOrCreateByGoogle({
      email: "new@example.com",
      googleId: "google-2",
      name: "New",
    });

    expect(stub.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        googleId: "google-2",
        name: "New",
      })
    );
    expect(result).toEqual({ isNewSignup: true, user: created });
  });

  test("surfaces identity conflict from link", async () => {
    stub.findByEmail.mockResolvedValue(makeTenantUser());
    stub.linkGoogleId.mockRejectedValue(
      createIdentityConflictError("This email is already linked to a different Google account")
    );

    await expect(
      stub.findOrCreateByGoogle({
        email: "tenant@example.com",
        googleId: "google-other",
        name: "Jane",
      })
    ).rejects.toMatchObject({ code: AccountError.IDENTITY_CONFLICT });
  });
});

describe("tenantUsersDb.findOrCreateByApple", () => {
  test("requires email for first-time signup", async () => {
    const stub = createStubDb();

    await expect(
      stub.findOrCreateByApple({
        appleId: "apple-1",
        email: null,
        name: "Apple User",
      })
    ).rejects.toThrow("Email required for first-time Apple sign-in");
  });
});
