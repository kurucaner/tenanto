import { afterEach, describe, expect, test } from "bun:test";

import {
  buildPortalInviteAcceptUrl,
  generatePortalInviteToken,
  hashPortalInviteToken,
} from "./tenant-portal-invite-token";

describe("tenant-portal-invite-token", () => {
  const originalTenantAppUrl = process.env.TENANT_APP_URL;

  afterEach(() => {
    if (originalTenantAppUrl === undefined) {
      delete process.env.TENANT_APP_URL;
    } else {
      process.env.TENANT_APP_URL = originalTenantAppUrl;
    }
  });

  test("hashPortalInviteToken is deterministic", () => {
    const token = "abc123";
    expect(hashPortalInviteToken(token)).toBe(hashPortalInviteToken(token));
  });

  test("generatePortalInviteToken returns unique hex strings", () => {
    const a = generatePortalInviteToken();
    const b = generatePortalInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test("buildPortalInviteAcceptUrl encodes token in tenant app accept path", () => {
    process.env.TENANT_APP_URL = "https://tenant.example.com/";
    const token = "invite-token";
    expect(buildPortalInviteAcceptUrl(token)).toBe(
      "https://tenant.example.com/accept-invite?token=invite-token"
    );
  });

  test("buildPortalInviteAcceptUrl throws when TENANT_APP_URL is missing", () => {
    delete process.env.TENANT_APP_URL;
    expect(() => buildPortalInviteAcceptUrl("token")).toThrow("TENANT_APP_URL is required");
  });
});
