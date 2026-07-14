import { afterEach, describe, expect, test } from "bun:test";

import { formatDocumentTitle, isQaEnvironment } from "./document-title";

describe("isQaEnvironment", () => {
  const originalHostEnv = import.meta.env.VITE_HOST_ENV;

  afterEach(() => {
    import.meta.env.VITE_HOST_ENV = originalHostEnv;
  });

  test("returns true when VITE_HOST_ENV is qa", () => {
    import.meta.env.VITE_HOST_ENV = "qa";
    expect(isQaEnvironment()).toBe(true);
  });

  test("returns true for case-insensitive QA", () => {
    import.meta.env.VITE_HOST_ENV = "QA";
    expect(isQaEnvironment()).toBe(true);
  });

  test("returns false for production", () => {
    import.meta.env.VITE_HOST_ENV = "production";
    expect(isQaEnvironment()).toBe(false);
  });
});

describe("formatDocumentTitle", () => {
  const originalDev = import.meta.env.DEV;
  const originalHostEnv = import.meta.env.VITE_HOST_ENV;

  afterEach(() => {
    import.meta.env.DEV = originalDev;
    import.meta.env.VITE_HOST_ENV = originalHostEnv;
  });

  test("appends qa suffix when VITE_HOST_ENV is qa and not local dev", () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_HOST_ENV = "qa";
    expect(formatDocumentTitle("Tenanto")).toBe("Tenanto (qa)");
  });
});
