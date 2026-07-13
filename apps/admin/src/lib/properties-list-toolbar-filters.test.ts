import { describe, expect, test } from "bun:test";

import {
  buildPropertiesListToolbarClearAllPatch,
  buildPropertiesListToolbarClearOnePatch,
  buildPropertiesListToolbarFilterItems,
  formatPropertiesListCountLabel,
} from "./properties-list-toolbar-filters";

describe("buildPropertiesListToolbarFilterItems", () => {
  test("returns a search chip when query is present", () => {
    expect(buildPropertiesListToolbarFilterItems("  alpha  ")).toEqual([
      { id: "q", label: "Search: alpha" },
    ]);
    expect(buildPropertiesListToolbarFilterItems("")).toEqual([]);
  });
});

describe("properties list toolbar clear patches", () => {
  test("clears search from one or all patches", () => {
    expect(buildPropertiesListToolbarClearOnePatch("q")).toEqual({ q: "" });
    expect(buildPropertiesListToolbarClearAllPatch()).toEqual({ q: "" });
  });
});

describe("formatPropertiesListCountLabel", () => {
  test("formats singular, plural, and paginated counts", () => {
    expect(formatPropertiesListCountLabel(1, false)).toBe("1 property");
    expect(formatPropertiesListCountLabel(12, false)).toBe("12 properties");
    expect(formatPropertiesListCountLabel(25, true)).toBe("25+ properties");
  });
});
