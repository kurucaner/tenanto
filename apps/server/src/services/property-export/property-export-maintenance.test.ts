import { describe, expect, test } from "bun:test";

import { buildProcessingTimeoutCutoff } from "./property-export-maintenance";

describe("buildProcessingTimeoutCutoff", () => {
  test("subtracts the configured timeout from now", () => {
    const nowMs = 1_700_000_000_000;
    const timeoutMs = 900_000;
    const cutoff = buildProcessingTimeoutCutoff(nowMs, timeoutMs);

    expect(cutoff.getTime()).toBe(nowMs - timeoutMs);
  });
});
