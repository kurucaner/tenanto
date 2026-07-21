import { describe, expect, test } from "bun:test";

import {
  HOME_WORKSPACE_PROPERTIES_MAX,
  mergeHomeWorkspaceProperties,
  partitionRecentEntriesByAccessibleList,
} from "@/lib/home-workspace-properties-utils";
import type { IRecentProperty } from "@/lib/recent-properties-storage";
import type { IProperty } from "@/packages/shared";

function makeProperty(id: string, name: string, isFavorite = false): IProperty {
  return {
    address: `${name} address`,
    callerRole: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "creator-1",
    favoritedAt: isFavorite ? "2026-01-02T00:00:00.000Z" : null,
    id,
    isFavorite,
    legalName: null,
    memberCount: 1,
    name,
    phoneNumber: null,
    unitCount: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeRecent(id: string, name: string): IRecentProperty {
  return {
    address: `${name} address`,
    id,
    lastPath: "/leases",
    name,
    visitedAt: "2026-01-03T00:00:00.000Z",
  };
}

describe("mergeHomeWorkspaceProperties", () => {
  test("prioritizes recents before favorites-first list items", () => {
    const merged = mergeHomeWorkspaceProperties(
      [makeRecent("recent", "Recent"), makeRecent("missing", "Missing")],
      [makeProperty("favorite", "Favorite", true), makeProperty("recent", "Recent")]
    );

    expect(merged.map((property) => property.id)).toEqual(["recent", "favorite"]);
  });

  test("caps merged properties at eight entries", () => {
    const listItems = Array.from({ length: HOME_WORKSPACE_PROPERTIES_MAX + 2 }, (_, index) =>
      makeProperty(String(index + 1), `Property ${index + 1}`)
    );

    expect(mergeHomeWorkspaceProperties([], listItems)).toHaveLength(HOME_WORKSPACE_PROPERTIES_MAX);
  });
});

describe("partitionRecentEntriesByAccessibleList", () => {
  test("splits recents into accessible and stale entries", () => {
    const partitioned = partitionRecentEntriesByAccessibleList(
      [
        makeRecent("accessible", "Accessible"),
        makeRecent("stale", "Stale"),
        makeRecent("accessible", "Accessible duplicate"),
      ],
      [makeProperty("accessible", "Accessible")]
    );

    expect(partitioned.accessibleRecentEntries.map((entry) => entry.id)).toEqual(["accessible"]);
    expect(partitioned.staleRecentEntries.map((entry) => entry.id)).toEqual(["stale"]);
  });

  test("deduplicates recent entries by property id", () => {
    const partitioned = partitionRecentEntriesByAccessibleList(
      [makeRecent("property-1", "First"), makeRecent("property-1", "Second")],
      [makeProperty("property-1", "Property")]
    );

    expect(partitioned.accessibleRecentEntries).toHaveLength(1);
    expect(partitioned.staleRecentEntries).toHaveLength(0);
  });
});
