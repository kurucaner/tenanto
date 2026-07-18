import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  AccountError,
  buildTenantSmsOptInConfirmationMessage,
  HttpStatus,
  type ITenantUser,
} from "@/packages/shared";
import type { TPhoneOtpVerifyResult } from "@/services/auth-phone-otp-service";

function makeTenantUser(overrides: Partial<ITenantUser> = {}): ITenantUser {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "tenant@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    id: "tenant-1",
    name: "Jane Tenant",
    phone: "+13055550100",
    phoneVerifiedAt: "2026-01-01T00:00:00.000Z",
    smsConsentedAt: "2026-01-01T00:00:00.000Z",
    smsOptedOutAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type TRateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

const mockIsPhoneAuthEnabled = mock(() => true);
const mockFindByVerifiedPhone = mock(() => Promise.resolve(null as ITenantUser | null));
const mockFindByPhone = mock(() => Promise.resolve(null as ITenantUser | null));
const mockGrantVerifiedPhoneWithSmsConsent = mock(() =>
  Promise.resolve({
    newlySubscribed: true,
    user: makeTenantUser(),
  })
);
const mockSendPhoneOtp = mock(() => Promise.resolve("+13055550100"));
const mockVerifyPhoneOtp = mock(
  (): Promise<TPhoneOtpVerifyResult> => Promise.resolve({ ok: false })
);
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
const mockSendSms = mock(() => Promise.resolve({}));

mock.module("@/lib/tenant-auth-expansion-config", () => ({
  isTenantPhoneAuthEnabled: mockIsPhoneAuthEnabled,
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findByPhone: mockFindByPhone,
    findByVerifiedPhone: mockFindByVerifiedPhone,
    grantVerifiedPhoneWithSmsConsent: mockGrantVerifiedPhoneWithSmsConsent,
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

mock.module("@/sns/sns", () => ({
  resolveSmsPhoneNumber: (phone: string) => {
    if (!phone.startsWith("+")) throw new Error("phone must be a valid E.164 phone number");
    return phone.trim();
  },
  sendSms: mockSendSms,
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

  test("does not send SMS when phone is verified but SMS consent is missing", async () => {
    mockFindByVerifiedPhone.mockResolvedValue(
      makeTenantUser({ phoneVerifiedAt: "2026-01-01T00:00:00.000Z", smsConsentedAt: null })
    );
    const result = await startTenantPhoneLogin({
      body: { phone: "+13055550100" },
      ip: "127.0.0.1",
    });
    expect(result).toEqual({ status: "ok" });
    expect(mockSendPhoneOtp).not.toHaveBeenCalled();
  });

  test("does not send SMS when tenant opted out", async () => {
    mockFindByVerifiedPhone.mockResolvedValue(
      makeTenantUser({ smsOptedOutAt: "2026-01-02T00:00:00.000Z" })
    );
    const result = await startTenantPhoneLogin({
      body: { phone: "+13055550100" },
      ip: "127.0.0.1",
    });
    expect(result).toEqual({ status: "ok" });
    expect(mockSendPhoneOtp).not.toHaveBeenCalled();
  });

  test("sends SMS when verified phone exists with SMS consent", async () => {
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
    mockGrantVerifiedPhoneWithSmsConsent.mockClear();
    mockSendSms.mockClear();
    mockVerifyPhoneOtp.mockResolvedValue({ ok: true, otpRowId: "otp-bind" });
    mockGrantVerifiedPhoneWithSmsConsent.mockResolvedValue({
      newlySubscribed: true,
      user: makeTenantUser(),
    });
  });

  test("bind start rejects missing SMS consent", async () => {
    const result = await startTenantPhoneBind({
      body: { phone: "+13055550100", smsConsent: false },
      ip: "127.0.0.1",
      tenantUserId: "tenant-1",
    });
    expect(result).toMatchObject({
      body: { error: "SMS consent is required to enable text alerts" },
      status: "error",
      statusCode: HttpStatus.BAD_REQUEST,
    });
    expect(mockSendPhoneOtp).not.toHaveBeenCalled();
  });

  test("bind start conflicts when phone owned by another user", async () => {
    mockFindByPhone.mockResolvedValue(makeTenantUser({ id: "other" }));
    const result = await startTenantPhoneBind({
      body: { phone: "+13055550100", smsConsent: true },
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

  test("bind start sends OTP when consent is granted", async () => {
    const result = await startTenantPhoneBind({
      body: { phone: "+13055550100", smsConsent: true },
      ip: "127.0.0.1",
      tenantUserId: "tenant-1",
    });
    expect(result).toEqual({ status: "ok" });
    expect(mockSendPhoneOtp).toHaveBeenCalledWith({
      phone: "+13055550100",
      purpose: "tenant_phone_bind",
    });
  });

  test("bind verify grants consent and sends opt-in confirmation once", async () => {
    const subscribedUser = makeTenantUser({
      smsConsentedAt: "2026-01-02T00:00:00.000Z",
    });
    mockGrantVerifiedPhoneWithSmsConsent.mockResolvedValue({
      newlySubscribed: true,
      user: subscribedUser,
    });

    const result = await verifyTenantPhoneBind({
      body: { code: "123456", phone: "+13055550100" },
      ip: "127.0.0.1",
      tenantUserId: "tenant-1",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.user?.smsConsentedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(mockGrantVerifiedPhoneWithSmsConsent).toHaveBeenCalledWith("tenant-1", "+13055550100");
    expect(mockSendSms).toHaveBeenCalledWith({
      message: buildTenantSmsOptInConfirmationMessage(),
      phoneNumber: "+13055550100",
    });
  });

  test("bind verify skips opt-in confirmation when already subscribed", async () => {
    const subscribedUser = makeTenantUser();
    mockGrantVerifiedPhoneWithSmsConsent.mockResolvedValue({
      newlySubscribed: false,
      user: subscribedUser,
    });

    const result = await verifyTenantPhoneBind({
      body: { code: "123456", phone: "+13055550100" },
      ip: "127.0.0.1",
      tenantUserId: "tenant-1",
    });

    expect(result.status).toBe("ok");
    expect(mockSendSms).not.toHaveBeenCalled();
  });
});

describe("buildTenantSmsOptInConfirmationMessage", () => {
  test("matches campaign sample 2", () => {
    expect(buildTenantSmsOptInConfirmationMessage()).toContain(
      "You're subscribed to account SMS alerts"
    );
  });
});
