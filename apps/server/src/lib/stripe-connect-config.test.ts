import { afterEach, describe, expect, test } from "bun:test";

import {
  isStripeConnectEnabled,
  isStripeConnectStandardOAuthEnabled,
  requireStripeConnectOperational,
  requireStripeConnectStandardOAuthConfigured,
  StripeConnectNotConfiguredError,
} from "./stripe-connect-config";

describe("stripe-connect-config", () => {
  const originalConnectFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalStandardOAuthFlag = process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
  const originalClientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const originalSecret = process.env.STRIPE_SECRET_KEY;

  const restore = () => {
    if (originalConnectFlag === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalConnectFlag;
    }
    if (originalStandardOAuthFlag === undefined) {
      delete process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = originalStandardOAuthFlag;
    }
    if (originalClientId === undefined) {
      delete process.env.STRIPE_CONNECT_CLIENT_ID;
    } else {
      process.env.STRIPE_CONNECT_CLIENT_ID = originalClientId;
    }
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
  };

  afterEach(() => {
    restore();
  });

  test("defaults to disabled when unset", () => {
    delete process.env.STRIPE_CONNECT_ENABLED;
    expect(isStripeConnectEnabled()).toBe(false);
  });

  test("accepts true/1/yes/on", () => {
    for (const value of ["true", "TRUE", "1", "yes", "on"]) {
      process.env.STRIPE_CONNECT_ENABLED = value;
      expect(isStripeConnectEnabled()).toBe(true);
    }
  });

  test("rejects false-ish values", () => {
    for (const value of ["false", "0", "no", "off", ""]) {
      process.env.STRIPE_CONNECT_ENABLED = value;
      expect(isStripeConnectEnabled()).toBe(false);
    }
  });

  test("requireStripeConnectOperational throws when flag off", () => {
    process.env.STRIPE_CONNECT_ENABLED = "false";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(() => requireStripeConnectOperational()).toThrow(StripeConnectNotConfiguredError);
  });

  test("requireStripeConnectOperational throws when secret missing", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => requireStripeConnectOperational()).toThrow(StripeConnectNotConfiguredError);
  });
});

describe("isStripeConnectStandardOAuthEnabled", () => {
  const originalConnectFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalStandardOAuthFlag = process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
  const originalClientId = process.env.STRIPE_CONNECT_CLIENT_ID;

  const restore = () => {
    if (originalConnectFlag === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalConnectFlag;
    }
    if (originalStandardOAuthFlag === undefined) {
      delete process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = originalStandardOAuthFlag;
    }
    if (originalClientId === undefined) {
      delete process.env.STRIPE_CONNECT_CLIENT_ID;
    } else {
      process.env.STRIPE_CONNECT_CLIENT_ID = originalClientId;
    }
  };

  afterEach(() => {
    restore();
  });

  const enableStandardOAuthEnv = () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";
  };

  test("defaults to disabled when Standard OAuth flag is unset", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";
    delete process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
    expect(isStripeConnectStandardOAuthEnabled()).toBe(false);
  });

  test("returns false when Connect client id is missing", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    delete process.env.STRIPE_CONNECT_CLIENT_ID;
    expect(isStripeConnectStandardOAuthEnabled()).toBe(false);
  });

  test("returns false when master Connect flag is off", () => {
    process.env.STRIPE_CONNECT_ENABLED = "false";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";
    expect(isStripeConnectStandardOAuthEnabled()).toBe(false);
  });

  test("returns true when Connect, Standard OAuth flag, and client id are set", () => {
    enableStandardOAuthEnv();
    expect(isStripeConnectStandardOAuthEnabled()).toBe(true);
  });
});

describe("requireStripeConnectStandardOAuthConfigured", () => {
  const originalConnectFlag = process.env.STRIPE_CONNECT_ENABLED;
  const originalStandardOAuthFlag = process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
  const originalClientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const originalSecret = process.env.STRIPE_SECRET_KEY;

  const restore = () => {
    if (originalConnectFlag === undefined) {
      delete process.env.STRIPE_CONNECT_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_ENABLED = originalConnectFlag;
    }
    if (originalStandardOAuthFlag === undefined) {
      delete process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
    } else {
      process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = originalStandardOAuthFlag;
    }
    if (originalClientId === undefined) {
      delete process.env.STRIPE_CONNECT_CLIENT_ID;
    } else {
      process.env.STRIPE_CONNECT_CLIENT_ID = originalClientId;
    }
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
  };

  afterEach(() => {
    restore();
  });

  test("throws when Standard OAuth flag is off", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    delete process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED;
    expect(() => requireStripeConnectStandardOAuthConfigured()).toThrow(
      StripeConnectNotConfiguredError
    );
  });

  test("throws when Connect client id is missing", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    delete process.env.STRIPE_CONNECT_CLIENT_ID;
    expect(() => requireStripeConnectStandardOAuthConfigured()).toThrow(
      StripeConnectNotConfiguredError
    );
  });

  test("throws when secret key is missing", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => requireStripeConnectStandardOAuthConfigured()).toThrow(
      StripeConnectNotConfiguredError
    );
  });

  test("does not throw when fully configured", () => {
    process.env.STRIPE_CONNECT_ENABLED = "true";
    process.env.STRIPE_CONNECT_STANDARD_OAUTH_ENABLED = "true";
    process.env.STRIPE_CONNECT_CLIENT_ID = "ca_test_client";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(() => requireStripeConnectStandardOAuthConfigured()).not.toThrow();
  });
});
