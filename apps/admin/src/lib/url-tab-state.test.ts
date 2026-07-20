import { describe, expect, test } from "bun:test";

import { buildFilterSearchPatch } from "@/lib/url-search-params";
import {
  buildUrlTabDefinitions,
  defineUrlTabSchema,
  resolveUrlTab,
} from "@/lib/url-tab-state";

const TABS = ["expenses", "income", "taxes", "channels"] as const;

describe("resolveUrlTab", () => {
  test("returns valid tab from raw value", () => {
    expect(resolveUrlTab("income", TABS, "expenses")).toBe("income");
  });

  test("returns default for invalid value", () => {
    expect(resolveUrlTab("invalid", TABS, "expenses")).toBe("expenses");
  });

  test("returns default for empty value", () => {
    expect(resolveUrlTab("", TABS, "expenses")).toBe("expenses");
  });
});

describe("defineUrlTabSchema", () => {
  test("serializes default tab as null", () => {
    const { schema } = defineUrlTabSchema(TABS, { defaultTab: "expenses" });
    expect(buildFilterSearchPatch(schema, { tab: "expenses" })).toEqual({ tab: null });
  });

  test("serializes non-default tab to query value", () => {
    const { schema } = defineUrlTabSchema(TABS, { defaultTab: "expenses" });
    expect(buildFilterSearchPatch(schema, { tab: "taxes" })).toEqual({ tab: "taxes" });
  });
});

describe("buildUrlTabDefinitions", () => {
  test("maps tabs and labels to definitions", () => {
    expect(
      buildUrlTabDefinitions(TABS, {
        channels: "Channels",
        expenses: "Expenses",
        income: "Income",
        taxes: "Taxes",
      })
    ).toEqual([
      { label: "Expenses", value: "expenses" },
      { label: "Income", value: "income" },
      { label: "Taxes", value: "taxes" },
      { label: "Channels", value: "channels" },
    ]);
  });
});
