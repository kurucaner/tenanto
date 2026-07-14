import { describe, expect, test } from "bun:test";

import {
  buildExportJobsCursorPredicate,
  buildExportJobsOrderByClause,
  resolveExportJobsListSort,
} from "./export-jobs-list-sort";

describe("resolveExportJobsListSort", () => {
  test("defaults to requestedAt desc", () => {
    const sort = resolveExportJobsListSort();
    expect(sort).toEqual({
      sortBy: "requestedAt",
      sortColumn: "created_at",
      sortDir: "desc",
      sortKeyKind: "date",
    });
  });

  test("resolves rowCount asc", () => {
    const sort = resolveExportJobsListSort("rowCount", "asc");
    expect(sort.sortColumn).toBe("row_count");
    expect(sort.sortDir).toBe("asc");
    expect(sort.sortKeyKind).toBe("num");
  });
});

describe("buildExportJobsOrderByClause", () => {
  test("requestedAt desc uses created_at with nulls last", () => {
    const sort = resolveExportJobsListSort("requestedAt", "desc");
    expect(buildExportJobsOrderByClause(sort)).toBe(
      "ORDER BY created_at DESC NULLS LAST, created_at DESC, id DESC"
    );
  });

  test("resourceType asc uses nulls first", () => {
    const sort = resolveExportJobsListSort("resourceType", "asc");
    expect(buildExportJobsOrderByClause(sort)).toBe(
      "ORDER BY resource_type ASC NULLS FIRST, created_at ASC, id ASC"
    );
  });
});

describe("buildExportJobsCursorPredicate", () => {
  test("desc sort uses less-than comparison", () => {
    const sort = resolveExportJobsListSort("status", "desc");
    const { nextParamIndex, predicate } = buildExportJobsCursorPredicate(sort, 3);
    expect(predicate).toBe("(status, created_at, id) < ($3::text, $4::timestamptz, $5::uuid)");
    expect(nextParamIndex).toBe(6);
  });

  test("asc rowCount sort uses greater-than with numeric cast", () => {
    const sort = resolveExportJobsListSort("rowCount", "asc");
    const { predicate } = buildExportJobsCursorPredicate(sort, 2);
    expect(predicate).toBe(
      "(row_count, created_at, id) > ($2::numeric, $3::timestamptz, $4::uuid)"
    );
  });
});
