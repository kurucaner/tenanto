import { describe, expect, test } from "bun:test";

import {
  buildTenantPhoneOtpSmsMessage,
  buildTenantSmsOptInConfirmationMessage,
  buildTenantSmsOptOutConfirmationMessage,
  canReceiveSms,
} from "./tenant-sms-utils";

describe("canReceiveSms", () => {
  test("returns true when phone is verified, consented, and not opted out", () => {
    expect(
      canReceiveSms({
        phoneVerifiedAt: "2026-01-01T00:00:00.000Z",
        smsConsentedAt: "2026-01-02T00:00:00.000Z",
        smsOptedOutAt: null,
      })
    ).toBe(true);
  });

  test("returns false when phone is not verified", () => {
    expect(
      canReceiveSms({
        phoneVerifiedAt: null,
        smsConsentedAt: "2026-01-02T00:00:00.000Z",
        smsOptedOutAt: null,
      })
    ).toBe(false);
  });

  test("returns false when consent is missing", () => {
    expect(
      canReceiveSms({
        phoneVerifiedAt: "2026-01-01T00:00:00.000Z",
        smsConsentedAt: null,
        smsOptedOutAt: null,
      })
    ).toBe(false);
  });

  test("returns false when opted out", () => {
    expect(
      canReceiveSms({
        phoneVerifiedAt: "2026-01-01T00:00:00.000Z",
        smsConsentedAt: "2026-01-02T00:00:00.000Z",
        smsOptedOutAt: "2026-01-03T00:00:00.000Z",
      })
    ).toBe(false);
  });
});

describe("buildTenantPhoneOtpSmsMessage", () => {
  test("includes code, expiry, and STOP/HELP footer", () => {
    const message = buildTenantPhoneOtpSmsMessage("847291");

    expect(message).toContain("847291");
    expect(message).toContain("10 minutes");
    expect(message).toContain("Reply STOP to opt out or HELP for help.");
  });
});

describe("buildTenantSmsOptInConfirmationMessage", () => {
  test("matches registered opt-in confirmation copy", () => {
    expect(buildTenantSmsOptInConfirmationMessage()).toBe(
      "PropertyOS: You're subscribed to account SMS alerts (OTP and transactional notices). Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel."
    );
  });
});

describe("buildTenantSmsOptOutConfirmationMessage", () => {
  test("matches registered stop confirmation copy", () => {
    expect(buildTenantSmsOptOutConfirmationMessage()).toBe(
      "PropertyOS: You're unsubscribed from SMS alerts. No further messages will be sent. Add your number again in PropertyOS settings to re-subscribe."
    );
  });
});
