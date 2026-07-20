import { beforeEach, describe, expect, mock, test } from "bun:test";

import { AuthOtpErrorCode } from "@/errors/auth-otp-errors";
import { mockResolved, mockResolvedNull, mockResolvedVoid } from "@/test-fixtures/mocks";

const mockFindMostRecent = mockResolvedNull<Date>();
const mockDeleteByPhone = mockResolvedVoid();
const mockCreate = mockResolvedVoid();
const mockFindValid = mockResolvedNull<{ codeHash: string; id: string }>();
const mockDeleteById = mockResolvedVoid();
const mockSendSms = mockResolved({});

mock.module("@/db/auth-phone-otps", () => ({
  authPhoneOtpsDb: {
    create: mockCreate,
    deleteById: mockDeleteById,
    deleteByPhoneAndPurpose: mockDeleteByPhone,
    findMostRecentCreatedAt: mockFindMostRecent,
    findValidByPhoneAndPurpose: mockFindValid,
  },
}));

mock.module("@/sns/sns", () => ({
  resolveSmsPhoneNumber: (phone: string) => {
    if (!phone.startsWith("+")) throw new Error("phone must be a valid E.164 phone number");
    return phone.trim();
  },
  sendSms: mockSendSms,
}));

const {
  buildPhoneOtpInProgressKey,
  buildTenantPhoneOtpSmsMessage,
  sendPhoneOtpWithCooldown,
  verifyPhoneOtpCode,
} = await import("./auth-phone-otp-service");

describe("auth-phone-otp-service", () => {
  beforeEach(() => {
    mockFindMostRecent.mockClear();
    mockDeleteByPhone.mockClear();
    mockCreate.mockClear();
    mockSendSms.mockClear();
    mockFindValid.mockClear();
    mockFindMostRecent.mockResolvedValue(null);
  });

  test("buildPhoneOtpInProgressKey scopes by purpose and phone", () => {
    expect(buildPhoneOtpInProgressKey("tenant_phone_login", "+13055550100")).toBe(
      "tenant_phone_login:+13055550100"
    );
  });

  test("buildTenantPhoneOtpSmsMessage includes code without STOP/HELP footer", () => {
    expect(buildTenantPhoneOtpSmsMessage("123456")).toContain("123456");
    expect(buildTenantPhoneOtpSmsMessage("123456")).not.toContain("Reply STOP");
  });

  test("sendPhoneOtpWithCooldown stores hash and sends SMS", async () => {
    await sendPhoneOtpWithCooldown({
      phone: "+13055550100",
      purpose: "tenant_phone_login",
    });

    expect(mockDeleteByPhone).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: "+13055550100",
      })
    );
  });

  test("sendPhoneOtpWithCooldown enforces cooldown", async () => {
    mockFindMostRecent.mockResolvedValue(new Date());
    await expect(
      sendPhoneOtpWithCooldown({
        phone: "+13055550100",
        purpose: "tenant_phone_login",
      })
    ).rejects.toMatchObject({ code: AuthOtpErrorCode.COOLDOWN_ACTIVE });
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  test("verifyPhoneOtpCode accepts matching code", async () => {
    const bcrypt = await import("bcrypt");
    const codeHash = await bcrypt.hash("123456", 10);
    mockFindValid.mockResolvedValue({ codeHash, id: "otp-1" });

    const result = await verifyPhoneOtpCode({
      otp: "123456",
      phone: "+13055550100",
      purpose: "tenant_phone_login",
    });
    expect(result).toEqual({ ok: true, otpRowId: "otp-1" });
  });
});
