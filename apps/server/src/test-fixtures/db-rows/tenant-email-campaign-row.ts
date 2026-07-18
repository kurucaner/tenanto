import { testDateTime } from "../dates";
import { TEST_PROPERTY_ID } from "../ids";

export type TTenantEmailCampaignRowOverrides = Record<string, unknown>;

export function buildTenantEmailCampaignRow(
  overrides: TTenantEmailCampaignRowOverrides = {}
): Record<string, unknown> {
  return {
    completed_at: null,
    created_at: testDateTime(0),
    created_by: "user-1",
    failed_count: 0,
    id: "11111111-1111-4111-8111-111111111111",
    idempotency_key: "key-1",
    property_id: TEST_PROPERTY_ID,
    recipient_count: 10,
    sent_count: 10,
    skipped_count: 0,
    status: "completed",
    subject: "Rent reminder July",
    updated_at: testDateTime(0),
    ...overrides,
  };
}
