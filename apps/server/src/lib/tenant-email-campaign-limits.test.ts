import { afterEach, describe, expect, test } from "bun:test";

import {
  formatTenantEmailCampaignRateLimitWindow,
  formatTenantEmailCampaignRetryAfter,
  getTenantEmailCampaignCreateRateLimitErrorMessage,
  isTenantEmailCampaignCreateRateLimitExceeded,
  resolveTenantEmailCampaignMaxRecipients,
  shouldAlertTenantEmailCampaignFailureRate,
} from "./tenant-email-campaign-limits";

describe("resolveTenantEmailCampaignMaxRecipients", () => {
  test("uses lower dev cap outside production", () => {
    expect(
      resolveTenantEmailCampaignMaxRecipients({
        devMaxRecipients: 50,
        isProduction: false,
        maxRecipients: 500,
      })
    ).toBe(50);
  });

  test("uses configured max in production", () => {
    expect(
      resolveTenantEmailCampaignMaxRecipients({
        devMaxRecipients: 50,
        isProduction: true,
        maxRecipients: 500,
      })
    ).toBe(500);
  });

  test("ignores dev cap when disabled with zero", () => {
    expect(
      resolveTenantEmailCampaignMaxRecipients({
        devMaxRecipients: 0,
        isProduction: false,
        maxRecipients: 500,
      })
    ).toBe(500);
  });
});

describe("isTenantEmailCampaignCreateRateLimitExceeded", () => {
  test("allows requests up to the limit", () => {
    expect(isTenantEmailCampaignCreateRateLimitExceeded(5, 5)).toBe(false);
    expect(isTenantEmailCampaignCreateRateLimitExceeded(6, 5)).toBe(true);
  });
});

describe("getTenantEmailCampaignCreateRateLimitErrorMessage", () => {
  test("includes the configured limit, window, and retry time", () => {
    expect(
      getTenantEmailCampaignCreateRateLimitErrorMessage({
        limit: 5,
        retryAfterSec: 847,
        windowMs: 900_000,
      })
    ).toBe(
      "You can send at most 5 tenant email campaigns per property every 15 minutes. Try again in 15 minutes."
    );
  });

  test("uses singular campaign wording for a limit of one", () => {
    expect(
      getTenantEmailCampaignCreateRateLimitErrorMessage({
        limit: 1,
        retryAfterSec: 45,
        windowMs: 60_000,
      })
    ).toBe(
      "You can send at most 1 tenant email campaign per property every 1 minute. Try again in 45 seconds."
    );
  });
});

describe("formatTenantEmailCampaignRateLimitWindow", () => {
  test("formats common windows", () => {
    expect(formatTenantEmailCampaignRateLimitWindow(60_000)).toBe("1 minute");
    expect(formatTenantEmailCampaignRateLimitWindow(900_000)).toBe("15 minutes");
    expect(formatTenantEmailCampaignRateLimitWindow(3_600_000)).toBe("1 hour");
  });
});

describe("formatTenantEmailCampaignRetryAfter", () => {
  test("formats retry delays", () => {
    expect(formatTenantEmailCampaignRetryAfter(30)).toBe("30 seconds");
    expect(formatTenantEmailCampaignRetryAfter(130)).toBe("3 minutes");
    expect(formatTenantEmailCampaignRetryAfter(3600)).toBe("1 hour");
  });
});

describe("shouldAlertTenantEmailCampaignFailureRate", () => {
  test("alerts when failure rate exceeds threshold", () => {
    expect(
      shouldAlertTenantEmailCampaignFailureRate({
        failedCount: 25,
        minRecipients: 10,
        sentCount: 75,
        threshold: 0.2,
      })
    ).toBe(true);
  });

  test("does not alert below minimum deliverable count", () => {
    expect(
      shouldAlertTenantEmailCampaignFailureRate({
        failedCount: 2,
        minRecipients: 10,
        sentCount: 3,
        threshold: 0.2,
      })
    ).toBe(false);
  });
});
