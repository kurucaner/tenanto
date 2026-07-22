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

  test("announcements tab keeps communications path with Announcements label", () => {
    const announcementsTab = getSearchablePropertyShellTabs().find(
      (tab) => tab.path === "communications"
    );

    expect(announcementsTab).toBeDefined();
    expect(announcementsTab!.label).toBe("Announcements");
    expect(announcementsTab!.path).toBe("communications");
    expect(getPropertyShellTabSearchTerms(announcementsTab!)).toEqual([
      "announcements",
      "communications",
      "announcement",
      "comm",
      "communication",
    ]);
  });
});
