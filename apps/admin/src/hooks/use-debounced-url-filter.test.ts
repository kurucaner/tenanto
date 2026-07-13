import { describe, expect, test } from "bun:test";

import {
  getDebouncedUrlCommitValue,
  resolveDebouncedUrlInputValue,
  shouldCommitDebouncedUrlValue,
} from "./use-debounced-url-filter-utils";

describe("useDebouncedUrlFilter utils", () => {
  test("resolveDebouncedUrlInputValue prefers draft over committed value", () => {
    expect(resolveDebouncedUrlInputValue(null, "ready")).toBe("ready");
    expect(resolveDebouncedUrlInputValue("typing", "ready")).toBe("typing");
  });

  test("getDebouncedUrlCommitValue trims whitespace", () => {
    expect(getDebouncedUrlCommitValue("  guest  ")).toBe("guest");
  });

  test("shouldCommitDebouncedUrlValue skips unchanged trimmed values", () => {
    expect(shouldCommitDebouncedUrlValue(" guest ", "guest")).toBe(false);
    expect(shouldCommitDebouncedUrlValue("alex", "")).toBe(true);
    expect(shouldCommitDebouncedUrlValue(" guest ", "other")).toBe(true);
  });
});
