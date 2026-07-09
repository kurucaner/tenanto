import { describe, expect, test } from "bun:test";

import {
  buildFilterSearchPatch,
  parseSortParam,
  patchSearchParams,
  readBooleanParam,
  readFiltersFromUrl,
  readParam,
  serializeBooleanParam,
  serializeParam,
  serializeSortParam,
} from "./url-search-params";

describe("readParam", () => {
  test("returns default when param is missing", () => {
    expect(readParam(new URLSearchParams(), "from", "2026-01-01")).toBe("2026-01-01");
  });

  test("returns param value when present", () => {
    expect(readParam(new URLSearchParams("from=2026-02-01"), "from", "2026-01-01")).toBe(
      "2026-02-01"
    );
  });
});

describe("serializeParam", () => {
  test("returns null for default or empty values", () => {
    expect(serializeParam("", "default")).toBeNull();
    expect(serializeParam("default", "default")).toBeNull();
  });

  test("returns value when different from default", () => {
    expect(serializeParam("active", "default")).toBe("active");
  });
});

describe("patchSearchParams", () => {
  test("sets and removes keys", () => {
    const current = new URLSearchParams("from=2026-01-01&channel=airbnb");
    const next = patchSearchParams(current, { channel: null, to: "2026-01-31" });
    expect(next.get("from")).toBe("2026-01-01");
    expect(next.get("to")).toBe("2026-01-31");
    expect(next.has("channel")).toBe(false);
  });
});

describe("parseSortParam", () => {
  test("falls back to defaults for invalid input", () => {
    expect(parseSortParam(null, "invalid", "date", "desc")).toEqual({
      columnId: "date",
      direction: "desc",
    });
  });

  test("parses column and direction", () => {
    expect(parseSortParam("amount", "asc", "date", "desc")).toEqual({
      columnId: "amount",
      direction: "asc",
    });
  });
});

describe("serializeSortParam", () => {
  test("omits default sort values", () => {
    expect(serializeSortParam({ columnId: "date", direction: "desc" }, "date", "desc")).toEqual({
      column: null,
      direction: null,
    });
  });
});

describe("readBooleanParam", () => {
  test("parses true and falls back to default", () => {
    expect(readBooleanParam(new URLSearchParams("includeDeleted=true"), "includeDeleted", false)).toBe(
      true
    );
    expect(readBooleanParam(new URLSearchParams(), "includeDeleted", false)).toBe(false);
  });
});

describe("serializeBooleanParam", () => {
  test("omits default boolean", () => {
    expect(serializeBooleanParam(false, false)).toBeNull();
    expect(serializeBooleanParam(true, false)).toBe("true");
  });
});

describe("readFiltersFromUrl", () => {
  test("reads multiple filters from schema", () => {
    const filters = readFiltersFromUrl(new URLSearchParams("channel=airbnb"), {
      channel: { defaultValue: "" },
      from: { defaultValue: "2026-01-01" },
    });
    expect(filters).toEqual({ channel: "airbnb", from: "2026-01-01" });
  });
});

describe("buildFilterSearchPatch", () => {
  test("builds omit patch for default values", () => {
    const patch = buildFilterSearchPatch(
      { channel: { defaultValue: "" }, from: { defaultValue: "2026-01-01" } },
      { channel: "airbnb", from: "2026-01-01" }
    );
    expect(patch).toEqual({ channel: "airbnb", from: null });
  });
});
