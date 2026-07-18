import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  buildTenantSmsHelpMessage,
  buildTenantSmsOptOutConfirmationMessage,
  type ITenantUser,
  TenantSmsInboundKeyword,
} from "@/packages/shared";

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

const mockIsPhoneAuthEnabled = mock(() => true);
const mockFindByPhone = mock(() => Promise.resolve(makeTenantUser()));
const mockOptOutOfSms = mock(() =>
  Promise.resolve(makeTenantUser({ smsOptedOutAt: "2026-01-02T00:00:00.000Z" }))
);
const mockInsertKeywordEvent = mock(() =>
  Promise.resolve({
    createdAt: "2026-01-02T00:00:00.000Z",
    id: "event-1",
    keyword: "stop",
    payloadSnippet: null,
    phone: "+13055550100",
    tenantUserId: "tenant-1",
  })
);
const mockSendSms = mock(() => Promise.resolve({}));

mock.module("@/lib/tenant-auth-expansion-config", () => ({
  isTenantPhoneAuthEnabled: mockIsPhoneAuthEnabled,
}));

mock.module("@/db/tenant-users", () => ({
  tenantUsersDb: {
    findByPhone: mockFindByPhone,
    optOutOfSms: mockOptOutOfSms,
  },
}));

mock.module("@/db/tenant-sms-keyword-events", () => ({
  tenantSmsKeywordEventsDb: {
    insert: mockInsertKeywordEvent,
  },
  truncatePayloadSnippet: (payload: unknown) => (payload == null ? null : JSON.stringify(payload)),
}));

mock.module("@/sns/sns", () => ({
  sendSms: mockSendSms,
}));

const { handleTenantInboundSms, TenantInboundSmsAction } =
  await import("./tenant-inbound-sms-service");

describe("handleTenantInboundSms", () => {
  beforeEach(() => {
    mockIsPhoneAuthEnabled.mockClear();
    mockFindByPhone.mockClear();
    mockOptOutOfSms.mockClear();
    mockInsertKeywordEvent.mockClear();
    mockSendSms.mockClear();
    mockIsPhoneAuthEnabled.mockReturnValue(true);
    mockFindByPhone.mockResolvedValue(makeTenantUser());
    mockOptOutOfSms.mockResolvedValue(
      makeTenantUser({ smsOptedOutAt: "2026-01-02T00:00:00.000Z" })
    );
  });

  test("returns null when phone auth flag is off", async () => {
    mockIsPhoneAuthEnabled.mockReturnValue(false);

    const result = await handleTenantInboundSms({
      message: {
        messageBody: "STOP",
        messageKeyword: null,
        originationNumber: "+13055550100",
      },
      payload: { message: "STOP", phoneNumber: "+13055550100" },
    });

    expect(result).toBeNull();
    expect(mockInsertKeywordEvent).not.toHaveBeenCalled();
  });

  test("STOP opts out known tenant and sends stop confirmation", async () => {
    const result = await handleTenantInboundSms({
      message: {
        messageBody: "STOP",
        messageKeyword: "STOP",
        originationNumber: "+13055550100",
      },
      payload: { messageBody: "STOP", originationNumber: "+13055550100" },
    });

    expect(result).toEqual({
      action: TenantInboundSmsAction.STOP_PROCESSED,
      keyword: TenantSmsInboundKeyword.STOP,
    });
    expect(mockInsertKeywordEvent).toHaveBeenCalled();
    expect(mockOptOutOfSms).toHaveBeenCalledWith("tenant-1");
    expect(mockSendSms).toHaveBeenCalledWith({
      message: buildTenantSmsOptOutConfirmationMessage(),
      phoneNumber: "+13055550100",
    });
  });

  test("STOP from unknown phone logs only", async () => {
    mockFindByPhone.mockResolvedValue(null);

    const result = await handleTenantInboundSms({
      message: {
        messageBody: "STOP",
        messageKeyword: null,
        originationNumber: "+13055550100",
      },
      payload: { message: "STOP", phoneNumber: "+13055550100" },
    });

    expect(result).toEqual({
      action: TenantInboundSmsAction.LOGGED,
      keyword: TenantSmsInboundKeyword.STOP,
    });
    expect(mockOptOutOfSms).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  test("HELP sends help copy without changing subscription", async () => {
    const result = await handleTenantInboundSms({
      message: {
        messageBody: "HELP",
        messageKeyword: "HELP",
        originationNumber: "+13055550100",
      },
      payload: { messageBody: "HELP", originationNumber: "+13055550100" },
    });

    expect(result).toEqual({
      action: TenantInboundSmsAction.HELP_REPLIED,
      keyword: TenantSmsInboundKeyword.HELP,
    });
    expect(mockOptOutOfSms).not.toHaveBeenCalled();
    expect(mockSendSms).toHaveBeenCalledWith({
      message: buildTenantSmsHelpMessage(),
      phoneNumber: "+13055550100",
    });
  });

  test("unknown keyword logs only", async () => {
    const result = await handleTenantInboundSms({
      message: {
        messageBody: "hello",
        messageKeyword: null,
        originationNumber: "+13055550100",
      },
      payload: { message: "hello", phoneNumber: "+13055550100" },
    });

    expect(result).toEqual({
      action: TenantInboundSmsAction.LOGGED,
      keyword: TenantSmsInboundKeyword.UNKNOWN,
    });
    expect(mockSendSms).not.toHaveBeenCalled();
  });
});
