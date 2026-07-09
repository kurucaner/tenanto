import { describe, expect, test } from "bun:test";

import {
  isNonNegativeMoneyInput,
  isOptionalNonNegativeMoneyInput,
  isPositiveMoneyInput,
  parseMoneyInput,
} from "@/lib/money-field-validation";

describe("parseMoneyInput", () => {
  test("returns null for empty or invalid input", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("12.345")).toBeNull();
  });

  test("parses valid decimal strings", () => {
    expect(parseMoneyInput("0")).toBe(0);
    expect(parseMoneyInput("12.50")).toBe(12.5);
  });
});

describe("isPositiveMoneyInput", () => {
  test("accepts values greater than zero", () => {
    expect(isPositiveMoneyInput("0.01")).toBe(true);
    expect(isPositiveMoneyInput("12.50")).toBe(true);
  });

  test("rejects zero, empty, and invalid values", () => {
    expect(isPositiveMoneyInput("0")).toBe(false);
    expect(isPositiveMoneyInput("")).toBe(false);
    expect(isPositiveMoneyInput("abc")).toBe(false);
  });
});

describe("isNonNegativeMoneyInput", () => {
  test("accepts zero and positive values", () => {
    expect(isNonNegativeMoneyInput("0")).toBe(true);
    expect(isNonNegativeMoneyInput("12.50")).toBe(true);
  });

  test("rejects empty and invalid values", () => {
    expect(isNonNegativeMoneyInput("")).toBe(false);
    expect(isNonNegativeMoneyInput("abc")).toBe(false);
  });
});

describe("isOptionalNonNegativeMoneyInput", () => {
  test("allows empty string", () => {
    expect(isOptionalNonNegativeMoneyInput("")).toBe(true);
  });

  test("delegates to non-negative validation when provided", () => {
    expect(isOptionalNonNegativeMoneyInput("0")).toBe(true);
    expect(isOptionalNonNegativeMoneyInput("12.50")).toBe(true);
    expect(isOptionalNonNegativeMoneyInput("abc")).toBe(false);
  });
});
