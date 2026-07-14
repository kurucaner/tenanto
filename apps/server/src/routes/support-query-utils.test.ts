import { describe, expect, test } from "bun:test";

import {
  parseOptionalSupportListDate,
  parseOptionalSupportListSortBy,
  parseOptionalSupportListSortDir,
  parseSupportListLimit,
} from "./support-query-utils";

describe("support list query parsing", () => {
  test("accepts supported sort values", () => {
    expect(parseOptionalSupportListSortBy("updatedAt")).toBe("updatedAt");
    expect(parseOptionalSupportListSortDir("asc")).toBe("asc");
  });

  test("rejects unsupported sort values", () => {
    expect(parseOptionalSupportListSortBy("submitter")).toBeNull();
    expect(parseOptionalSupportListSortDir("sideways")).toBeNull();
  });

  test("keeps list limits within the supported range", () => {
    expect(parseSupportListLimit("0")).toBe(20);
    expect(parseSupportListLimit("250")).toBe(100);
  });

  test("accepts valid date filters and rejects invalid ones", () => {
    expect(parseOptionalSupportListDate(undefined)).toBeUndefined();
    expect(parseOptionalSupportListDate("")).toBeUndefined();
    expect(parseOptionalSupportListDate("2026-07-01")).toBe("2026-07-01");
    expect(parseOptionalSupportListDate("07/01/2026")).toBeNull();
  });
});
