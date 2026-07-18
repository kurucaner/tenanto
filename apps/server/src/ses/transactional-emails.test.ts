import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { mockResolvedVoid } from "@/test-fixtures/mocks";

const mockSendTransactionalEmail = mockResolvedVoid();

mock.module("./ses", () => ({
  sendSesEmail: mockResolvedVoid(),
  sendTransactionalEmail: mockSendTransactionalEmail,
}));

const {
  sendLeaseEndedEmail,
  sendRentPaymentRecordedEmail,
  sendTenantPortalInviteExistingEmail,
  sendTenantPortalInviteNewEmail,
} = await import("./transactional-emails");

describe("tenant email-gated transactional emails", () => {
  const originalFlag = process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;

  beforeEach(() => {
    mockSendTransactionalEmail.mockClear();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;
    } else {
      process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = originalFlag;
    }
  });

  test("does not send rent payment email when TENANT_EMAIL_NOTIFICATIONS_ENABLED is unset", async () => {
    delete process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;

    const sent = await sendRentPaymentRecordedEmail("jane@example.com", {
      amount: "$1,500.00",
      paymentDate: "March 15, 2026",
      propertyName: "Sunset Apartments",
      rentMonthLabel: "March 2026",
      tenantName: "Jane Tenant",
      unitLabel: "Unit 101",
    });

    expect(sent).toBe(false);
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  test("does not send lease ended email when TENANT_EMAIL_NOTIFICATIONS_ENABLED is unset", async () => {
    delete process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;

    const sent = await sendLeaseEndedEmail("jane@example.com", {
      contractEndDate: "March 31, 2026",
      finalMonthPlain: "",
      finalMonthSection: "",
      holdoverPlain: "",
      holdoverSection: "",
      leaseStartDate: "January 1, 2026",
      moveOutDate: "March 31, 2026",
      paymentStatusLine: "Final month rent is recorded — you're all set.",
      propertyName: "Sunset Apartments",
      tenantName: "Jane Tenant",
      unitLabel: "Unit 101",
    });

    expect(sent).toBe(false);
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  test("does not send portal invite emails when TENANT_EMAIL_NOTIFICATIONS_ENABLED is unset", async () => {
    delete process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;

    const inviteOpts = {
      acceptUrl: "https://tenant.example.com/invite/token",
      displayName: "Jane Tenant",
      propertyName: "Sunset Apartments",
      unitLabel: "Unit 101",
    };

    const sentNew = await sendTenantPortalInviteNewEmail("jane@example.com", inviteOpts);
    const sentExisting = await sendTenantPortalInviteExistingEmail("jane@example.com", inviteOpts);

    expect(sentNew).toBe(false);
    expect(sentExisting).toBe(false);
    expect(mockSendTransactionalEmail).not.toHaveBeenCalled();
  });

  test("sends rent payment email when TENANT_EMAIL_NOTIFICATIONS_ENABLED is true", async () => {
    process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = "true";

    const sent = await sendRentPaymentRecordedEmail("jane@example.com", {
      amount: "$1,500.00",
      paymentDate: "March 15, 2026",
      propertyName: "Sunset Apartments",
      rentMonthLabel: "March 2026",
      tenantName: "Jane Tenant",
      unitLabel: "Unit 101",
    });

    expect(sent).toBe(true);
    expect(mockSendTransactionalEmail).toHaveBeenCalledTimes(1);
  });
});
