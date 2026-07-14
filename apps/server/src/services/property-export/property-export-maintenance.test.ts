import { describe, expect, test } from "bun:test";

import { PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS } from "@/lib/property-export-config";

import { buildProcessingTimeoutCutoff } from "./property-export-maintenance";

describe("buildProcessingTimeoutCutoff", () => {
  test("subtracts the configured timeout from now", () => {
    const nowMs = 1_700_000_000_000;
    const cutoff = buildProcessingTimeoutCutoff(nowMs, PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS);

    expect(cutoff.getTime()).toBe(nowMs - PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS);
  });
});
