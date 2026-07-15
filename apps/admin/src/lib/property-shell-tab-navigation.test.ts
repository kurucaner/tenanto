import { describe, expect, test } from "bun:test";

import { PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";

import {
  buildPropertyShellTabPath,
  resolveActivePropertyShellTab,
} from "./property-shell-tab-navigation";

const PROPERTY_ID = "abc-123";

describe("property shell tab navigation", () => {
  test("buildPropertyShellTabPath returns overview and section paths", () => {
    expect(buildPropertyShellTabPath(PROPERTY_ID, PROPERTY_SHELL_TABS[0]!)).toBe(
      `/properties/${PROPERTY_ID}`
    );
    expect(buildPropertyShellTabPath(PROPERTY_ID, PROPERTY_SHELL_TABS[3]!)).toBe(
      `/properties/${PROPERTY_ID}/income`
    );
  });

  test("resolveActivePropertyShellTab matches overview", () => {
    const active = resolveActivePropertyShellTab(
      `/properties/${PROPERTY_ID}`,
      PROPERTY_ID,
      PROPERTY_SHELL_TABS
    );
    expect(active.path).toBe("");
    expect(active.label).toBe("Overview");
  });

  test("resolveActivePropertyShellTab matches top-level section", () => {
    const active = resolveActivePropertyShellTab(
      `/properties/${PROPERTY_ID}/income`,
      PROPERTY_ID,
      PROPERTY_SHELL_TABS
    );
    expect(active.path).toBe("income");
  });

  test("resolveActivePropertyShellTab matches nested lease detail under leases", () => {
    const active = resolveActivePropertyShellTab(
      `/properties/${PROPERTY_ID}/leases/lease-456`,
      PROPERTY_ID,
      PROPERTY_SHELL_TABS
    );
    expect(active.path).toBe("leases");
  });

  test("resolveActivePropertyShellTab falls back to overview for unknown suffix", () => {
    const active = resolveActivePropertyShellTab(
      `/properties/${PROPERTY_ID}/unknown-section`,
      PROPERTY_ID,
      PROPERTY_SHELL_TABS
    );
    expect(active.path).toBe("");
    expect(active.label).toBe("Overview");
  });
});
