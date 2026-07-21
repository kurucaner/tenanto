import { describe, expect, test } from "bun:test";

import {
  getPropertyShellTabSearchTerms,
  getSearchablePropertyShellTabs,
} from "@/lib/property-launcher-destinations";

describe("getPropertyShellTabSearchTerms", () => {
  test("includes label, path, and configured aliases", () => {
    const exportsTab = getSearchablePropertyShellTabs().find((tab) => tab.path === "exports");

    expect(exportsTab).toBeDefined();
    expect(getPropertyShellTabSearchTerms(exportsTab!)).toEqual(["exports", "export"]);
  });
});
