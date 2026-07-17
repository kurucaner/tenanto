import { describe, expect, test } from "bun:test";

import {
  getPersonNameValidationError,
  normalizePersonName,
  validatePersonName,
} from "./person-name-utils";

describe("normalizePersonName", () => {
  test("trims and collapses internal whitespace", () => {
    expect(normalizePersonName("  John   Doe  ")).toBe("John Doe");
  });

  test("normalizes unicode to NFC", () => {
    expect(normalizePersonName("Jose\u0301")).toBe("José");
  });
});

describe("getPersonNameValidationError", () => {
  test("accepts common display names", () => {
    expect(getPersonNameValidationError("Mary-Jane O'Connor")).toBeNull();
    expect(getPersonNameValidationError("J.R. Smith")).toBeNull();
    expect(getPersonNameValidationError("José García")).toBeNull();
    expect(getPersonNameValidationError("李雷")).toBeNull();
  });

  test("rejects empty names", () => {
    expect(getPersonNameValidationError("   ")).toBe("Name is required");
  });

  test("rejects names without letters", () => {
    expect(getPersonNameValidationError("123")).toBe("Name must contain at least one letter");
    expect(getPersonNameValidationError("---")).toBe("Name must contain at least one letter");
  });

  test("rejects invalid characters", () => {
    expect(getPersonNameValidationError("John@Doe")).toBe("Name contains invalid characters");
    expect(getPersonNameValidationError("John!!!")).toBe("Name contains invalid characters");
  });

  test("rejects doubled punctuation", () => {
    expect(getPersonNameValidationError("John--Doe")).toBe("Name has invalid punctuation");
    expect(getPersonNameValidationError("O''Connor")).toBe("Name has invalid punctuation");
  });

  test("rejects edge punctuation", () => {
    expect(getPersonNameValidationError("-John")).toBe("Name cannot start or end with punctuation");
    expect(getPersonNameValidationError("John-")).toBe("Name cannot start or end with punctuation");
  });
});

describe("validatePersonName", () => {
  test("rejects non-string values", () => {
    expect(validatePersonName(null)).toBe("Name must be a string");
  });
});
