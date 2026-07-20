import { describe, expect, test } from "bun:test";

import { getHomeSuggestedNavItems } from "@/lib/home-suggested-nav-items";
import { UserType } from "@/packages/shared";

describe("getHomeSuggestedNavItems", () => {
  test("excludes Home and Properties", () => {
    const items = getHomeSuggestedNavItems(UserType.USER);
    const hrefs = items.map((item) => item.href);

    expect(hrefs).not.toContain("/home");
    expect(hrefs).not.toContain("/properties");
  });

  test("includes Reports and Support for regular users", () => {
    const items = getHomeSuggestedNavItems(UserType.USER);

    expect(items.some((item) => item.href === "/reports")).toBe(true);
    expect(items.some((item) => item.href === "/support-requests")).toBe(true);
  });

  test("includes admin links for platform admins", () => {
    const items = getHomeSuggestedNavItems(UserType.ADMIN);
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toContain("/users");
    expect(hrefs).toContain("/activity");
    expect(hrefs).toContain("/config");
  });

  test("caps at six items", () => {
    expect(getHomeSuggestedNavItems(UserType.ADMIN).length).toBeLessThanOrEqual(6);
  });
});
