import { describe, expect, test } from "bun:test";

import { parseIngestTarget } from "./parse-ingest-target";

describe("parseIngestTarget", () => {
  test("parses a valid encoded RUM target", () => {
    const encoded = encodeURIComponent(
      "/api/v2/rum?ddsource=browser&dd-api-key=pub123&dd-evp-origin=browser"
    );

    expect(parseIngestTarget(encoded)).toEqual({
      pathname: "/api/v2/rum",
      search: "?ddsource=browser&dd-api-key=pub123&dd-evp-origin=browser",
    });
  });

  test("parses a target without query string", () => {
    expect(parseIngestTarget(encodeURIComponent("/api/v2/logs"))).toEqual({
      pathname: "/api/v2/logs",
      search: "",
    });
  });

  test("rejects missing target", () => {
    expect(parseIngestTarget(null)).toBeNull();
    expect(parseIngestTarget("")).toBeNull();
    expect(parseIngestTarget("   ")).toBeNull();
  });

  test("rejects malformed encoded target", () => {
    expect(parseIngestTarget("%E0%A4%A")).toBeNull();
  });

  test("rejects targets that do not start with /", () => {
    expect(parseIngestTarget(encodeURIComponent("api/v2/rum"))).toBeNull();
  });

  test("rejects disallowed intake paths", () => {
    expect(parseIngestTarget(encodeURIComponent("/api/v1/rum?ddsource=browser"))).toBeNull();
    expect(parseIngestTarget(encodeURIComponent("/health"))).toBeNull();
  });
});
