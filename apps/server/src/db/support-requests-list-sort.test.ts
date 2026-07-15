import { describe, expect, test } from "bun:test";

import {
  buildSupportRequestsCursorPredicate,
  buildSupportRequestsOrderByClause,
  resolveSupportRequestsListSort,
} from "./support-requests-list-sort";

describe("resolveSupportRequestsListSort", () => {
  test("defaults to createdAt descending", () => {
    expect(resolveSupportRequestsListSort()).toEqual({
      sortBy: "createdAt",
      sortColumn: "sr.created_at",
      sortDir: "desc",
      sortKeyCast: "::timestamptz",
    });
  });

  test("casts enum-backed category sorting to text", () => {
    expect(resolveSupportRequestsListSort("category", "asc")).toEqual({
      sortBy: "category",
      sortColumn: "sr.category::text",
      sortDir: "asc",
      sortKeyCast: "::text",
    });
  });
});

describe("support request list SQL sorting", () => {
  test("uses deterministic descending tiebreakers", () => {
    const sort = resolveSupportRequestsListSort("updatedAt", "desc");
    expect(buildSupportRequestsOrderByClause(sort)).toBe(
      "ORDER BY sr.updated_at DESC, sr.created_at DESC, sr.id DESC"
    );
  });

  test("uses ascending cursor comparison and typed values", () => {
    const sort = resolveSupportRequestsListSort("status", "asc");
    expect(buildSupportRequestsCursorPredicate(sort, 4)).toEqual({
      nextParamIndex: 7,
      predicate: "(sr.status::text, sr.created_at, sr.id) > ($4::text, $5::timestamptz, $6::uuid)",
    });
  });
});
