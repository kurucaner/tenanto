import { describe, expect, test } from "bun:test";

import {
  isStripeConnectEnabled,
  requireStripeConnectOperational,
  StripeConnectNotConfiguredError,
} from "./stripe-connect-config";

describe("stripe-connect-config", () => {
  const originalFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalSecret = process.env.STRIPE_SECRET_KEY;

  const restore = () => {
    if (originalFlag === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalFlag;
    }
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
  };

  test("defaults to disabled when unset", () => {
    delete process.env.STRIPE_CONNECT_ENABLED;
    expect(isStripeConnectEnabled()).toBe(false);
    restore();
  });

  test("accepts true/1/yes/on", () => {
    for (const value of ["true", "TRUE", "1", "yes", "on"]) {
      process.env.STRIPE_CONNECT_ENABLED = value;
      expect(isStripeConnectEnabled()).toBe(true);
    }
    restore();
  });

  test("rejects false-ish values", () => {
    for (const value of ["false", "0", "no", "off", ""]) {
      process.env.STRIPE_CONNECT_ENABLED = value;
      expect(isStripeConnectEnabled()).toBe(false);
    }
    restore();
  });

  test("requireStripeConnectOperational throws when flag off", () => {
    process.env.STRIPE_CONNECT_ENABLED = "false";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(() => requireStripeConnectOperational()).toThrow(StripeConnectNotConfiguredError);
    restore();
  });

  test("requireStripeConnectOperational throws when secret missing", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => requireStripeConnectOperational()).toThrow(StripeConnectNotConfiguredError);
    restore();
  });
});
