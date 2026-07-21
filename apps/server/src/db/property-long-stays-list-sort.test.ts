import { describe, expect, test } from "bun:test";

import {
  buildPropertyLongStaysCursorPredicate,
  buildPropertyLongStaysOrderByClause,
  resolvePropertyLongStaysListSort,
} from "./property-long-stays-list-sort";

describe("resolvePropertyLongStaysListSort", () => {
  test("defaults to start desc", () => {
    const sort = resolvePropertyLongStaysListSort();
    expect(sort).toEqual({
      sortBy: "start",
      sortColumn: "pls.lease_start_date",
      sortDir: "desc",
      sortKeyKind: "date",
    });
  });

  test("resolves rent asc", () => {
    const sort = resolvePropertyLongStaysListSort("rent", "asc");
    expect(sort.sortColumn).toBe("pls.rent_amount");
    expect(sort.sortDir).toBe("asc");
    expect(sort.sortKeyKind).toBe("num");
  });
});

describe("buildPropertyLongStaysOrderByClause", () => {
  test("start desc uses lease_start_date with nulls last", () => {
    const sort = resolvePropertyLongStaysListSort("start", "desc");
    expect(buildPropertyLongStaysOrderByClause(sort)).toBe(
      "ORDER BY pls.lease_start_date DESC NULLS LAST, pls.created_at DESC, pls.id DESC"
    );
  });

  test("tenant asc uses nulls first", () => {
    const sort = resolvePropertyLongStaysListSort("tenant", "asc");
    expect(buildPropertyLongStaysOrderByClause(sort)).toBe(
      "ORDER BY pls.guest_name ASC NULLS FIRST, pls.created_at ASC, pls.id ASC"
    );
  });
});

describe("buildPropertyLongStaysCursorPredicate", () => {
  test("desc sort uses less-than comparison", () => {
    const sort = resolvePropertyLongStaysListSort("status", "desc");
    const { nextParamIndex, predicate } = buildPropertyLongStaysCursorPredicate(sort, 3);
    expect(predicate).toBe(
      "(pls.status::text, pls.created_at, pls.id) < ($3::text, $4::timestamptz, $5::uuid)"
    );
    expect(nextParamIndex).toBe(6);
  });

  test("asc rent sort uses greater-than with numeric cast", () => {
    const sort = resolvePropertyLongStaysListSort("rent", "asc");
    const { predicate } = buildPropertyLongStaysCursorPredicate(sort, 2);
    expect(predicate).toBe(
      "(pls.rent_amount, pls.created_at, pls.id) > ($2::numeric, $3::timestamptz, $4::uuid)"
    );
  });
});
