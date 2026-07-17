import { describe, expect, test } from "bun:test";

import { buildObfuscatedProxyUrl } from "./build-obfuscated-proxy-url";

describe("buildObfuscatedProxyUrl", () => {
  test("builds a neutral ingest URL with encoded Datadog target", () => {
    const url = buildObfuscatedProxyUrl("https://propertyos-proxy.propertyos.app", {
      parameters: "ddsource=browser&dd-api-key=pub123",
      path: "/api/v2/rum",
    });

    expect(url.startsWith("https://propertyos-proxy.propertyos.app/ingest?t=")).toBe(true);
    expect(url).not.toContain("/rum?ddsource=");
    expect(url).not.toContain("dd-api-key=");
  });

  test("includes ddforwardSubdomain in encoded target", () => {
    const url = buildObfuscatedProxyUrl("https://propertyos-proxy.propertyos.app", {
      parameters: "ddsource=browser",
      path: "/api/v2/rum",
      subdomain: "session",
    });

    const encodedTarget = new URL(url).searchParams.get("t");
    expect(encodedTarget).toContain("ddforwardSubdomain=session");
  });
});
