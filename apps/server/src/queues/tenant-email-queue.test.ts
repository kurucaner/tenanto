import { describe, expect, test } from "bun:test";

import { buildTenantEmailSendJobId } from "./tenant-email-queue";

describe("buildTenantEmailSendJobId", () => {
  test("does not use colons", () => {
    const jobId = buildTenantEmailSendJobId(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "11111111-2222-3333-4444-555555555555"
    );

    expect(jobId).not.toContain(":");
    expect(jobId).toBe(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee__11111111-2222-3333-4444-555555555555"
    );
  });
});
