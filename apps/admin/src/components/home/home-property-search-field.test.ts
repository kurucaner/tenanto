import { describe, expect, test } from "bun:test";

import { buildPropertiesListSearchPath } from "@/components/home/home-property-search-field";

describe("buildPropertiesListSearchPath", () => {
  test("returns properties list path when query is empty", () => {
    expect(buildPropertiesListSearchPath("")).toBe("/properties");
    expect(buildPropertiesListSearchPath("   ")).toBe("/properties");
  });

  test("returns encoded search query path", () => {
    expect(buildPropertiesListSearchPath("oak street")).toBe("/properties?q=oak%20street");
  });
});
