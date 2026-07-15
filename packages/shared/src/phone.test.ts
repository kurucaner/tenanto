import { describe, expect, test } from "bun:test";

import { isValidE164, normalizeToE164 } from "./phone";

describe("normalizeToE164", () => {
  test("normalizes US numbers with country code", () => {
    expect(normalizeToE164("+1 (305) 555-0100")).toBe("+13055550100");
    expect(normalizeToE164("+13055550100")).toBe("+13055550100");
  });

  test("returns null for empty or invalid", () => {
    expect(normalizeToE164("")).toBeNull();
    expect(normalizeToE164("not-a-phone")).toBeNull();
    expect(normalizeToE164("123")).toBeNull();
  });
});

describe("isValidE164", () => {
  test("accepts empty as valid optional field", () => {
    expect(isValidE164("")).toBe(true);
  });

  test("validates E.164 numbers", () => {
    expect(isValidE164("+13055550100")).toBe(true);
    expect(isValidE164("3055550100")).toBe(false);
  });
});
