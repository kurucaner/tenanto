import { describe, expect, test } from "bun:test";

import {
  matchPropertyShellTabs,
  parseWorkspaceSearchQuery,
  tokenizeWorkspaceSearchQuery,
} from "@/lib/workspace-search-query";

describe("tokenizeWorkspaceSearchQuery", () => {
  test("splits on whitespace and normalizes casing", () => {
    expect(tokenizeWorkspaceSearchQuery("  Sunset   Exports  ")).toEqual(["sunset", "exports"]);
  });
});

describe("matchPropertyShellTabs", () => {
  test("matches aliases and prefixes", () => {
    expect(matchPropertyShellTabs("export").map((tab) => tab.label)).toEqual(["Exports"]);
    expect(matchPropertyShellTabs("exp").map((tab) => tab.label)).toEqual(["Expenses", "Exports"]);
  });
});

describe("parseWorkspaceSearchQuery", () => {
  test("parses tab-only queries with aliases", () => {
    expect(parseWorkspaceSearchQuery("exports")).toEqual({
      matchedTabs: [{ label: "Exports", path: "exports" }],
      mode: "tabOnly",
      propertyQuery: "",
    });
    expect(parseWorkspaceSearchQuery("export")).toEqual({
      matchedTabs: [{ label: "Exports", path: "exports" }],
      mode: "tabOnly",
      propertyQuery: "",
    });
  });

  test("parses ambiguous tab prefixes", () => {
    expect(parseWorkspaceSearchQuery("exp")).toEqual({
      matchedTabs: [
        { label: "Expenses", path: "expenses" },
        { label: "Exports", path: "exports" },
      ],
      mode: "tabOnly",
      propertyQuery: "",
    });
  });

  test("parses combined property and tab queries", () => {
    expect(parseWorkspaceSearchQuery("sunset exports")).toEqual({
      matchedTabs: [{ label: "Exports", path: "exports" }],
      mode: "propertyAndTab",
      propertyQuery: "sunset",
    });
  });

  test("parses property-only queries", () => {
    expect(parseWorkspaceSearchQuery("sunset")).toEqual({
      matchedTabs: [],
      mode: "propertyOnly",
      propertyQuery: "sunset",
    });
  });

  test("parses properties prefix queries", () => {
    expect(parseWorkspaceSearchQuery("properties: sunset")).toEqual({
      matchedTabs: [],
      mode: "propertyOnly",
      propertyQuery: "sunset",
    });
  });

  test("parses overview tab queries", () => {
    expect(parseWorkspaceSearchQuery("overview")).toEqual({
      matchedTabs: [{ end: true, label: "Overview", path: "" }],
      mode: "tabOnly",
      propertyQuery: "",
    });
  });

  test("treats tab tokens separately from property tokens", () => {
    expect(parseWorkspaceSearchQuery("export house")).toEqual({
      matchedTabs: [{ label: "Exports", path: "exports" }],
      mode: "propertyAndTab",
      propertyQuery: "house",
    });
  });

  test("returns idle for empty input", () => {
    expect(parseWorkspaceSearchQuery("   ")).toEqual({
      matchedTabs: [],
      mode: "idle",
      propertyQuery: "",
    });
  });
});
