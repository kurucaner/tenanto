import { afterEach, describe, expect, test } from "bun:test";

import {
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
