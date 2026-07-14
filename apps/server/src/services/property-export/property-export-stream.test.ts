import { describe, expect, test } from "bun:test";

import { ExportJobStatus } from "@/packages/shared";

import {
  resetExportJobStreamThrottle,
  shouldEmitExportJobUpdate,
} from "./property-export-stream";

describe("shouldEmitExportJobUpdate", () => {
  test("always emits terminal statuses", () => {
    expect(
      shouldEmitExportJobUpdate("job-1", ExportJobStatus.COMPLETED, 1_000)
    ).toBe(true);
    expect(
      shouldEmitExportJobUpdate("job-1", ExportJobStatus.FAILED, 1_001)
    ).toBe(true);
  });

  test("throttles processing updates by elapsed time", () => {
    resetExportJobStreamThrottle("job-2");

    expect(
      shouldEmitExportJobUpdate("job-2", ExportJobStatus.PROCESSING, 1_000)
    ).toBe(true);

    expect(
      shouldEmitExportJobUpdate("job-2", ExportJobStatus.PROCESSING, 1_500)
    ).toBe(false);

    expect(
      shouldEmitExportJobUpdate("job-2", ExportJobStatus.PROCESSING, 3_100)
    ).toBe(true);
  });
});
