import { beforeEach, describe, expect, mock, test } from "bun:test";

import { AccountError, HttpStatus, type ITenantUser } from "@/packages/shared";

function makeTenantUser(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "tenant@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Jane Tenant",
    phone: "+13055550100",
    phoneVerifiedAt: "2026-01-01T00:00:00.000Z",
    smsConsentedAt: null,
    smsOptedOutAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type TRateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

const mockIsPhoneAuthEnabled = mock(() => true);
const mockFindByVerifiedPhone = mock(() => Promise.resolve(null as ITenantUser | null));
const mockFindByPhone = mock(() => Promise.resolve(null as ITenantUser | null));
const mockSetVerifiedPhone = mock(() => Promise.resolve(makeTenantUser()));
const mockSendPhoneOtp = mock(() => Promise.resolve("+13055550100"));
const mockVerifyPhoneOtp = mock(() => Promise.resolve({ ok: false as const }));
const mockDeletePhoneOtp = mock(() => Promise.resolve());
const mockPhoneRateLimit = mock((): Promise<TRateLimitResult> =>
  Promise.resolve({ allowed: true })
);
const mockIssueTenantSession = mock(() =>
  Promise.resolve({
    accessToken: "access",
    refreshToken: "refresh",
    user: makeTenantUser(),
  })
);

mock.module("@/lib/tenant-auth-expansion-config", () => ({
  isTenantPhoneAuthEnabled: mockIsPhoneAuthEnabled,
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findByPhone: mockFindByPhone,
    findByVerifiedPhone: mockFindByVerifiedPhone,
    setVerifiedPhone: mockSetVerifiedPhone,
  },
}));

mock.module("@/services/auth-phone-otp-service", () => ({
  deletePhoneOtpById: mockDeletePhoneOtp,
  sendPhoneOtpWithCooldown: mockSendPhoneOtp,
  verifyPhoneOtpCode: mockVerifyPhoneOtp,
}));

mock.module("@/services/tenant-auth-rate-limit", () => ({
  assertTenantAuthPhoneAttemptAllowed: mockPhoneRateLimit,
  getTenantAuthRateLimitErrorMessage: () => "rate limited",
}));

mock.module("@/services/tenant-auth-service", () => ({
  issueTenantSession: mockIssueTenantSession,
}));

const {
  startTenantPhoneBind,
  startTenantPhoneLogin,
  verifyTenantPhoneBind,
  verifyTenantPhoneLogin,
} = await import("./tenant-phone-auth-service");

const mockServer = {} as import("fastify").FastifyInstance;

describe("startTenantPhoneLogin", () => {
  beforeEach(() => {
    mockIsPhoneAuthEnabled.mockClear();
    mockFindByVerifiedPhone.mockClear();
    mockSendPhoneOtp.mockClear();
    mockPhoneRateLimit.mockClear();
    mockIsPhoneAuthEnabled.mockReturnValue(true);
    mockPhoneRateLimit.mockResolvedValue({ allowed: true });
    mockFindByVerifiedPhone.mockResolvedValue(null);
    mockSendPhoneOtp.mockResolvedValue("+13055550100");
  });

  test("returns 404 when phone auth flag is off", async () => {
    mockIsPhoneAuthEnabled.mockReturnValue(false);
    const result = await startTenantPhoneLogin({
      body: { phone: "+13055550100" },
      ip: "127.0.0.1",
    });
    expect(result).toMatchObject({ status: "error", statusCode: HttpStatus.NOT_FOUND });
    expect(mockSendPhoneOtp).not.toHaveBeenCalled();
  });

  test("does not send SMS for unknown phone (anti-enumeration)", async () => {
    const result = await startTenantPhoneLogin({
      body: { phone: "+13055550100" },
      ip: "127.0.0.1",
    });
    expect(result).toEqual({ status: "ok" });
    expect(mockSendPhoneOtp).not.toHaveBeenCalled();
  });

  test("sends SMS when verified phone exists", async () => {
    mockFindByVerifiedPhone.mockResolvedValue(makeTenantUser());
    const result = await startTenantPhoneLogin({
      body: { phone: "+13055550100" },
      ip: "127.0.0.1",
    });
    expect(result).toEqual({ status: "ok" });
    expect(mockSendPhoneOtp).toHaveBeenCalledWith({
      phone: "+13055550100",
      purpose: "tenant_phone_login",
    });
  });
});

describe("verifyTenantPhoneLogin", () => {
  beforeEach(() => {
    mockIsPhoneAuthEnabled.mockReturnValue(true);
    mockPhoneRateLimit.mockResolvedValue({ allowed: true });
    mockVerifyPhoneOtp.mockResolvedValue({ ok: true, otpRowId: "otp-1" });
    mockFindByVerifiedPhone.mockResolvedValue(makeTenantUser());
    mockDeletePhoneOtp.mockClear();
    mockIssueTenantSession.mockClear();
  });

  test("issues session after valid OTP", async () => {
    const result = await verifyTenantPhoneLogin(mockServer, {
      body: { code: "123456", phone: "+13055550100" },
      ip: "127.0.0.1",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.session?.accessToken).toBe("access");
    expect(mockDeletePhoneOtp).toHaveBeenCalledWith("otp-1");
    expect(mockIssueTenantSession).toHaveBeenCalled();
  });

  test("rejects unknown phone after failed OTP path", async () => {
    mockVerifyPhoneOtp.mockResolvedValue({ ok: false });
    const result = await verifyTenantPhoneLogin(mockServer, {
      body: { code: "000000", phone: "+13055550100" },
      ip: "127.0.0.1",
    });
    expect(result).toMatchObject({
      status: "error",
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  });
});

describe("tenant phone bind", () => {
  beforeEach(() => {
    mockIsPhoneAuthEnabled.mockReturnValue(true);
    mockPhoneRateLimit.mockResolvedValue({ allowed: true });
    mockFindByPhone.mockResolvedValue(null);
    mockSendPhoneOtp.mockClear();
    mockSetVerifiedPhone.mockClear();
    mockVerifyPhoneOtp.mockResolvedValue({ ok: true, otpRowId: "otp-bind" });
    mockSetVerifiedPhone.mockResolvedValue(makeTenantUser());
  });

  test("bind start conflicts when phone owned by another user", async () => {
    mockFindByPhone.mockResolvedValue(makeTenantUser({ id: "other" }));
    const result = await startTenantPhoneBind({
      body: { phone: "+13055550100" },
      ip: "127.0.0.1",
      tenantUserId: "tenant-1",
    });
    expect(result).toMatchObject({
      body: { code: AccountError.IDENTITY_CONFLICT },
      status: "error",
      statusCode: HttpStatus.CONFLICT,
    });
    expect(mockSendPhoneOtp).not.toHaveBeenCalled();
  });

  test("bind start sends OTP", async () => {
    const result = await startTenantPhoneBind({
      body: { phone: "+13055550100" },
      ip: "127.0.0.1",
      tenantUserId: "tenant-1",
    });
    expect(result).toEqual({ status: "ok" });
    expect(mockSendPhoneOtp).toHaveBeenCalledWith({
      phone: "+13055550100",
      purpose: "tenant_phone_bind",
    });
  });

  test("bind verify sets verified phone", async () => {
    const result = await verifyTenantPhoneBind({
      body: { code: "123456", phone: "+13055550100" },
      ip: "127.0.0.1",
      tenantUserId: "tenant-1",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.user?.phone).toBe("+13055550100");
    expect(mockSetVerifiedPhone).toHaveBeenCalledWith("tenant-1", "+13055550100");
  });
});
