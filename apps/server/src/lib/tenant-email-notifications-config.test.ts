import { describe, expect, test } from "bun:test";

import { isTenantEmailNotificationsEnabled } from "./tenant-email-notifications-config";

describe("tenant-email-notifications-config", () => {
  const originalFlag = process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;

  const restore = () => {
    if (originalFlag === undefined) {
      delete process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;
    } else {
      process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = originalFlag;
    }
  };

  test("tenant email notifications default to disabled when unset", () => {
    delete process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED;
    expect(isTenantEmailNotificationsEnabled()).toBe(false);
    restore();
  });

  test("accepts true/1/yes/on", () => {
    for (const value of ["true", "TRUE", "1", "yes", "on"]) {
      process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = value;
      expect(isTenantEmailNotificationsEnabled()).toBe(true);
    }
    restore();
  });

  test("rejects false-ish values", () => {
    for (const value of ["false", "0", "no", "off", ""]) {
      process.env.TENANT_EMAIL_NOTIFICATIONS_ENABLED = value;
      expect(isTenantEmailNotificationsEnabled()).toBe(false);
    }
    restore();
  });
});
