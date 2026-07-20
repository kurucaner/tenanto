import { describe, expect, test } from "bun:test";

import { HttpStatus } from "@/packages/shared";

import {
  TenantEmailCampaignErrorCode,
  tenantEmailCampaignNoRecipientsError,
  tenantEmailCampaignNotFoundError,
} from "./tenant-email-campaign-errors";

describe("tenant email campaign domain errors", () => {
  test("tenantEmailCampaignNotFoundError uses 404", () => {
    const error = tenantEmailCampaignNotFoundError();

    expect(error.code).toBe(TenantEmailCampaignErrorCode.NOT_FOUND);
    expect(error.httpStatus).toBe(HttpStatus.NOT_FOUND);
  });

  test("tenantEmailCampaignNoRecipientsError uses 400", () => {
    expect(tenantEmailCampaignNoRecipientsError().httpStatus).toBe(HttpStatus.BAD_REQUEST);
  });
});
