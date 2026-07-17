import { afterEach, describe, expect, test } from "bun:test";

import {
  buildPropertyMemberInviteAcceptUrl,
  generatePropertyMemberInviteToken,
  hashPropertyMemberInviteToken,
  propertyMemberInviteTokenMatchesHash,
} from "./property-member-invite-token";

describe("property-member-invite-token", () => {
  const originalPlatformAppUrl = process.env.PLATFORM_APP_URL;

  afterEach(() => {
    if (originalPlatformAppUrl === undefined) {
      delete process.env.PLATFORM_APP_URL;
    } else {
      process.env.PLATFORM_APP_URL = originalPlatformAppUrl;
    }
  });

  test("hashPropertyMemberInviteToken is deterministic", () => {
    const token = "abc123";
    expect(hashPropertyMemberInviteToken(token)).toBe(hashPropertyMemberInviteToken(token));
  });

  test("propertyMemberInviteTokenMatchesHash accepts matching digests", () => {
    const token = generatePropertyMemberInviteToken();
    expect(propertyMemberInviteTokenMatchesHash(token, hashPropertyMemberInviteToken(token))).toBe(
      true
    );
    expect(
      propertyMemberInviteTokenMatchesHash(token, hashPropertyMemberInviteToken("other-token"))
    ).toBe(false);
    expect(propertyMemberInviteTokenMatchesHash(token, "not-a-hex-digest")).toBe(false);
  });

  test("generatePropertyMemberInviteToken returns unique hex strings", () => {
    const a = generatePropertyMemberInviteToken();
    const b = generatePropertyMemberInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test("buildPropertyMemberInviteAcceptUrl encodes token in admin accept path", () => {
    process.env.PLATFORM_APP_URL = "https://admin.example.com/";
    const token = "invite-token";
    expect(buildPropertyMemberInviteAcceptUrl(token)).toBe(
      "https://admin.example.com/accept-invite?token=invite-token"
    );
  });

  test("buildPropertyMemberInviteAcceptUrl throws when PLATFORM_APP_URL is missing", () => {
    delete process.env.PLATFORM_APP_URL;
    expect(() => buildPropertyMemberInviteAcceptUrl("token")).toThrow(
      "PLATFORM_APP_URL is required"
    );
  });
});
