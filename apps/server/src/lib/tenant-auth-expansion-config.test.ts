import { describe, expect, test } from "bun:test";

import { isTenantPhoneAuthEnabled } from "./tenant-auth-expansion-config";

describe("tenant-auth-expansion-config", () => {
  const originalPhone = process.env.TENANT_PHONE_AUTH_ENABLED;

  const restore = () => {
    if (originalPhone === undefined) {
      delete process.env.TENANT_PHONE_AUTH_ENABLED;
    } else {
      process.env.TENANT_PHONE_AUTH_ENABLED = originalPhone;
    }
  };

  test("phone auth defaults to disabled when unset", () => {
    delete process.env.TENANT_PHONE_AUTH_ENABLED;
    expect(isTenantPhoneAuthEnabled()).toBe(false);
    restore();
  });

  test("accepts true/1/yes/on", () => {
    for (const value of ["true", "TRUE", "1", "yes", "on"]) {
      process.env.TENANT_PHONE_AUTH_ENABLED = value;
      expect(isTenantPhoneAuthEnabled()).toBe(true);
    }
    restore();
  });

  test("rejects false-ish values", () => {
    for (const value of ["false", "0", "no", "off", ""]) {
      process.env.TENANT_PHONE_AUTH_ENABLED = value;
      expect(isTenantPhoneAuthEnabled()).toBe(false);
    }
    restore();
  });
});
