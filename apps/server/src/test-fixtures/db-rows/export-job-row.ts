import { testDateTime } from "../dates";
import { TEST_PROPERTY_ID } from "../ids";

export type TExportJobRowOverrides = Record<string, unknown>;

export function buildExportJobRow(overrides: TExportJobRowOverrides = {}): Record<string, unknown> {
  return {
    completed_at: null,
    created_at: testDateTime(0),
    created_by: "user-1",
    error_message: null,
    expires_at: null,
    file_name: "expenses-july.csv",
    filters: {},
    format: "csv",
    id: "11111111-1111-4111-8111-111111111111",
    property_id: TEST_PROPERTY_ID,
    resource_type: "expenses",
    row_count: 42,
    status: "completed",
    updated_at: testDateTime(0),
    ...overrides,
  };
}
