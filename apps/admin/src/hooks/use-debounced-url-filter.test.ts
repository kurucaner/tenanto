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

  test("getDebouncedUrlCommitValue preserves spaces while typing multi-word queries", () => {
    expect(getDebouncedUrlCommitValue("John ")).toBe("John ");
    expect(getDebouncedUrlCommitValue("John Doe")).toBe("John Doe");
    expect(getDebouncedUrlCommitValue("  guest  ")).toBe("  guest  ");
  });

  test("shouldCommitDebouncedUrlValue compares raw draft and committed values", () => {
    expect(shouldCommitDebouncedUrlValue("John ", "John")).toBe(true);
    expect(shouldCommitDebouncedUrlValue(" guest ", "guest")).toBe(true);
    expect(shouldCommitDebouncedUrlValue("alex", "")).toBe(true);
    expect(shouldCommitDebouncedUrlValue("guest", "guest")).toBe(false);
  });
});
