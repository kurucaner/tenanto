import { afterEach, describe, expect, test } from "bun:test";

import { formatDocumentTitle, isQaEnvironment } from "./document-title";

describe("isQaEnvironment", () => {
  const originalDdEnv = import.meta.env.VITE_DD_ENV;

  afterEach(() => {
    import.meta.env.VITE_DD_ENV = originalDdEnv;
  });

  test("returns true when VITE_DD_ENV is qa", () => {
    import.meta.env.VITE_DD_ENV = "qa";
    expect(isQaEnvironment()).toBe(true);
  });

  test("returns true for case-insensitive QA", () => {
    import.meta.env.VITE_DD_ENV = "QA";
    expect(isQaEnvironment()).toBe(true);
  });

  test("returns false for production", () => {
    import.meta.env.VITE_DD_ENV = "production";
    expect(isQaEnvironment()).toBe(false);
  });
});

describe("formatDocumentTitle", () => {
  const originalDev = import.meta.env.DEV;
  const originalDdEnv = import.meta.env.VITE_DD_ENV;

  afterEach(() => {
    import.meta.env.DEV = originalDev;
    import.meta.env.VITE_DD_ENV = originalDdEnv;
  });

  test("appends qa suffix when VITE_DD_ENV is qa and not local dev", () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_DD_ENV = "qa";
    expect(formatDocumentTitle("PropertyOS")).toBe("PropertyOS (qa)");
  });
});
