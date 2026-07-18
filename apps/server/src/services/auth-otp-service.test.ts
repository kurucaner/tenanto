import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockResolvedNull,
  mockResolvedVoid,
} from "@/test-fixtures/mocks";

const mockFindMostRecentCreatedAt = mockResolvedNull<Date>();
const mockDeleteByEmailAndPurpose = mockResolvedVoid();
const mockCreate = mockResolvedVoid();
const mockFindValidByEmailAndPurpose = mockResolvedNull<{ codeHash: string; id: string }>();
const mockSendTransactionalEmail = mockResolvedVoid();

mock.module("@/db/auth-otps", () => ({
  authOtpsDb: {
    create: mockCreate,
    deleteByEmailAndPurpose: mockDeleteByEmailAndPurpose,
    deleteById: mockResolvedVoid(),
    findMostRecentCreatedAt: mockFindMostRecentCreatedAt,
    findValidByEmailAndPurpose: mockFindValidByEmailAndPurpose,
  },
}));

mock.module("@/ses/ses", () => ({
  sendSesEmail: mockResolvedVoid(),
  sendTransactionalEmail: mockSendTransactionalEmail,
}));

const {
  buildOtpInProgressKey,
  generateOtp,
  OtpAlreadySendingError,
  OtpCooldownActiveError,
  sendOtpWithCooldown,
  verifyOtpCode,
} = await import("./auth-otp-service");

describe("buildOtpInProgressKey", () => {
  test("scopes in-flight guard by purpose and email", () => {
    expect(buildOtpInProgressKey("register", "User@Example.com")).toBe("register:user@example.com");
    expect(buildOtpInProgressKey("tenant_register", "User@Example.com")).toBe(
      "tenant_register:user@example.com"
    );
  });
});

describe("generateOtp", () => {
  test("returns a 6-digit code", () => {
    expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe("sendOtpWithCooldown", () => {
  beforeEach(() => {
    mockFindMostRecentCreatedAt.mockReset();
    mockDeleteByEmailAndPurpose.mockReset();
    mockCreate.mockReset();
    mockSendTransactionalEmail.mockReset();
    mockFindMostRecentCreatedAt.mockResolvedValue(null);
  });

  test("sends OTP when cooldown has elapsed", async () => {
    await sendOtpWithCooldown({ email: "user@example.com", purpose: "register" });

    expect(mockDeleteByEmailAndPurpose).toHaveBeenCalledWith("user@example.com", "register");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockSendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  test("rejects when cooldown is active", async () => {
    mockFindMostRecentCreatedAt.mockResolvedValue(new Date());

    await expect(
      sendOtpWithCooldown({ email: "user@example.com", purpose: "register" })
    ).rejects.toBeInstanceOf(OtpCooldownActiveError);
  });

  test("allows parallel purposes for the same email", async () => {
    await Promise.all([
      sendOtpWithCooldown({ email: "user@example.com", purpose: "register" }),
      sendOtpWithCooldown({ email: "user@example.com", purpose: "tenant_register" }),
    ]);

    expect(mockSendTransactionalEmail).toHaveBeenCalledTimes(2);
  });

  test("rejects duplicate in-flight sends for the same purpose", async () => {
    mockFindMostRecentCreatedAt.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return null;
    });

    const first = sendOtpWithCooldown({ email: "user@example.com", purpose: "register" });
    await expect(
      sendOtpWithCooldown({ email: "user@example.com", purpose: "register" })
    ).rejects.toBeInstanceOf(OtpAlreadySendingError);
    await first;
  });
});

describe("verifyOtpCode", () => {
  beforeEach(() => {
    mockFindValidByEmailAndPurpose.mockReset();
  });

  test("returns false when no valid OTP exists", async () => {
    mockFindValidByEmailAndPurpose.mockResolvedValue(null);

    const result = await verifyOtpCode({
      email: "user@example.com",
      otp: "123456",
      purpose: "register",
    });

    expect(result).toEqual({ ok: false });
  });
});
