import { describe, expect, test } from "bun:test";

import { parsePropertyExportsListQuery } from "./parse-property-exports-list-query";

describe("parsePropertyExportsListQuery", () => {
  test("accepts empty query with defaults", () => {
    const parsed = parsePropertyExportsListQuery({});
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.filters).toEqual({});
    expect(parsed.limit).toBeGreaterThan(0);
    expect(parsed.cursor).toBeUndefined();
  });

  test("parses filters and sort", () => {
    const parsed = parsePropertyExportsListQuery({
      from: "2026-01-01",
      q: "expenses",
      resourceType: "income",
      sortBy: "rowCount",
      sortDir: "asc",
      to: "2026-01-31",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.filters).toEqual({
      from: "2026-01-01",
      q: "expenses",
      resourceType: "income",
      sortBy: "rowCount",
      sortDir: "asc",
      to: "2026-01-31",
    });
  });

  test("rejects invalid resourceType", () => {
    const parsed = parsePropertyExportsListQuery({ resourceType: "portfolio" });
    expect(parsed).toEqual({
      error: "resourceType must be expenses, income, or leases",
      ok: false,
    });
  });

  test("rejects invalid sortBy", () => {
    const parsed = parsePropertyExportsListQuery({ sortBy: "fileName" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain("sortBy must be one of");
  });

  test("rejects invalid date", () => {
    const parsed = parsePropertyExportsListQuery({ from: "not-a-date" });
    expect(parsed).toEqual({ error: "from must be a YYYY-MM-DD date", ok: false });
  });

  test("rejects invalid cursor", () => {
    const parsed = parsePropertyExportsListQuery({ cursor: "not-valid" });
    expect(parsed).toEqual({ error: "Invalid cursor", ok: false });
  });
});
