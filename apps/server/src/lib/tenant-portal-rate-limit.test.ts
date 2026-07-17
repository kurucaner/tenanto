import { describe, expect, test } from "bun:test";

import { getTenantAuthRateLimitErrorMessage } from "@/services/tenant-auth-rate-limit";
import { getTenantPortalInviteCreateRateLimitErrorMessage } from "@/services/tenant-portal-invite-create-rate-limit";

import { formatRateLimitRetryAfter, formatRateLimitWindow } from "./rate-limit-messages";

describe("formatRateLimitWindow", () => {
  test("formats common windows", () => {
    expect(formatRateLimitWindow(60_000)).toBe("1 minute");
    expect(formatRateLimitWindow(900_000)).toBe("15 minutes");
    expect(formatRateLimitWindow(3_600_000)).toBe("1 hour");
  });
});

describe("formatRateLimitRetryAfter", () => {
  test("formats retry delays", () => {
    expect(formatRateLimitRetryAfter(30)).toBe("30 seconds");
    expect(formatRateLimitRetryAfter(130)).toBe("3 minutes");
    expect(formatRateLimitRetryAfter(3600)).toBe("1 hour");
  });
});

describe("getTenantPortalInviteCreateRateLimitErrorMessage", () => {
  test("includes the configured limit, window, and retry time", () => {
    expect(
      getTenantPortalInviteCreateRateLimitErrorMessage({
        limit: 10,
        retryAfterSec: 847,
        windowMs: 900_000,
      })
    ).toBe(
      "You can send at most 10 portal invites per lease every 15 minutes. Try again in 15 minutes."
    );
  });

  test("uses singular invite wording for a limit of one", () => {
    expect(
      getTenantPortalInviteCreateRateLimitErrorMessage({
        limit: 1,
        retryAfterSec: 45,
        windowMs: 60_000,
      })
    ).toBe(
      "You can send at most 1 portal invite per lease every 1 minute. Try again in 45 seconds."
    );
  });
});

describe("getTenantAuthRateLimitErrorMessage", () => {
  test("includes window and retry time", () => {
    expect(
      getTenantAuthRateLimitErrorMessage({
        retryAfterSec: 90,
        windowMs: 900_000,
      })
    ).toBe(
      "Too many authentication attempts. Limit applies every 15 minutes. Try again in 90 seconds."
    );
  });
});
