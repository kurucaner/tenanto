import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildTenantSmsOptInConfirmationMessage, type ITenantUser } from "@/packages/shared";

const mockSendSms = mock(() => Promise.resolve({}));

mock.module("@/sns/sns", () => ({
  sendSms: mockSendSms,
}));

const { sendTenantOptInConfirmationSms, sendTenantSms } = await import("./tenant-sms-service");

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

describe("sendTenantSms", () => {
  beforeEach(() => {
    mockSendSms.mockClear();
  });

  test("sends SMS when tenant can receive SMS", async () => {
    await sendTenantSms({
      message: "PropertyOS: test",
      phoneNumber: "+13055550100",
      tenantUser: makeTenantUser(),
    });

    expect(mockSendSms).toHaveBeenCalledWith({
      message: "PropertyOS: test",
      phoneNumber: "+13055550100",
    });
  });

  test("does not send SMS when tenant opted out", async () => {
    await sendTenantSms({
      message: "PropertyOS: test",
      phoneNumber: "+13055550100",
      tenantUser: makeTenantUser({ smsOptedOutAt: "2026-01-02T00:00:00.000Z" }),
    });

    expect(mockSendSms).not.toHaveBeenCalled();
  });
});

describe("sendTenantOptInConfirmationSms", () => {
  beforeEach(() => {
    mockSendSms.mockClear();
  });

  test("sends campaign opt-in confirmation copy", async () => {
    await sendTenantOptInConfirmationSms({
      phoneNumber: "+13055550100",
      tenantUser: makeTenantUser(),
    });

    expect(mockSendSms).toHaveBeenCalledWith({
      message: buildTenantSmsOptInConfirmationMessage(),
      phoneNumber: "+13055550100",
    });
  });
});
