import { beforeEach, describe, expect, mock, test } from "bun:test";

import { HttpStatus, type ITenantUser } from "@/packages/shared";

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
    smsOptedOutAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

const mockIsPhoneAuthEnabled = mock(() => true);
const mockOptOutOfSms = mock(() => Promise.resolve(makeTenantUser()));

mock.module("@/lib/tenant-auth-expansion-config", () => ({
  isTenantPhoneAuthEnabled: mockIsPhoneAuthEnabled,
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    optOutOfSms: mockOptOutOfSms,
  },
}));

const { optOutTenantSms } = await import("./tenant-sms-settings-service");

describe("optOutTenantSms", () => {
  beforeEach(() => {
    mockIsPhoneAuthEnabled.mockClear();
    mockOptOutOfSms.mockClear();
    mockIsPhoneAuthEnabled.mockReturnValue(true);
    mockOptOutOfSms.mockResolvedValue(makeTenantUser());
  });

  test("returns 404 when phone auth flag is off", async () => {
    mockIsPhoneAuthEnabled.mockReturnValue(false);
    const result = await optOutTenantSms("tenant-1");
    expect(result).toMatchObject({ status: "error", statusCode: HttpStatus.NOT_FOUND });
    expect(mockOptOutOfSms).not.toHaveBeenCalled();
  });

  test("clears phone and records opt-out", async () => {
    const result = await optOutTenantSms("tenant-1");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.user.phone).toBeNull();
    expect(result.user.phoneVerifiedAt).toBeNull();
    expect(result.user.smsOptedOutAt).toBe("2026-01-02T00:00:00.000Z");
    expect(mockOptOutOfSms).toHaveBeenCalledWith("tenant-1");
  });

  test("returns not found when tenant user is missing", async () => {
    mockOptOutOfSms.mockResolvedValue(null);
    const result = await optOutTenantSms("missing");
    expect(result).toMatchObject({
      status: "error",
      statusCode: HttpStatus.NOT_FOUND,
    });
  });
});
