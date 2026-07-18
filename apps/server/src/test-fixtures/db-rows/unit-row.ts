import { testDateTime } from "../dates";
import { TEST_PROPERTY_ID } from "../ids";

export type TUnitRowOverrides = Record<string, unknown>;

export function buildUnitRow(overrides: TUnitRowOverrides = {}): Record<string, unknown> {
  return {
    created_at: testDateTime(0),
    deleted_at: null,
    id: "11111111-1111-4111-8111-111111111111",
    is_deleted: false,
    layout: "1BR",
    property_id: TEST_PROPERTY_ID,
    rental_type: "short_term",
    unit_number: "101",
    updated_at: testDateTime(0),
    ...overrides,
  };
}

export const UNIT_PAGINATION_COUNT_ROW = {
  long_term_count: 1,
  short_term_count: 2,
  total_count: 3,
};
