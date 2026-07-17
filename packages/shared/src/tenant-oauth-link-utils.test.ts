import { describe, expect, test } from "bun:test";

import {
  isPhoneOwnedByOtherUser,
  resolveOauthProviderLinkDecision,
} from "./tenant-oauth-link-utils";

describe("resolveOauthProviderLinkDecision", () => {
  test("can_link when no provider stored", () => {
    expect(resolveOauthProviderLinkDecision({ providerId: "g-1", storedProviderId: null })).toBe(
      "can_link"
    );
    expect(resolveOauthProviderLinkDecision({ providerId: "g-1", storedProviderId: "" })).toBe(
      "can_link"
    );
  });

  test("already_linked when ids match", () => {
    expect(resolveOauthProviderLinkDecision({ providerId: "g-1", storedProviderId: "g-1" })).toBe(
      "already_linked"
    );
  });

  test("conflict when ids differ", () => {
    expect(resolveOauthProviderLinkDecision({ providerId: "g-2", storedProviderId: "g-1" })).toBe(
      "conflict"
    );
  });
});

describe("isPhoneOwnedByOtherUser", () => {
  test("false when unowned or same owner", () => {
    expect(isPhoneOwnedByOtherUser({ candidateOwnerId: "a", existingOwnerId: null })).toBe(false);
    expect(isPhoneOwnedByOtherUser({ candidateOwnerId: "a", existingOwnerId: "a" })).toBe(false);
  });

  test("true when owned by someone else", () => {
    expect(isPhoneOwnedByOtherUser({ candidateOwnerId: "a", existingOwnerId: "b" })).toBe(true);
  });
});
