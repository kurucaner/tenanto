import { testDateTime, testIsoDate } from "../dates";
import { TEST_INCOME_LINE_TYPE_ID, TEST_PROPERTY_ID } from "../ids";

export type TIncomeLineRowOverrides = Record<string, unknown>;

export function buildIncomeLineRow(
  overrides: TIncomeLineRowOverrides = {}
): Record<string, unknown> {
  return {
    amount: "100.00",
    channel_commission: "0.00",
    created_at: testDateTime(0),
    deleted_at: null,
    description: null,
    gross_income: "100.00",
    guest_name: null,
    id: "11111111-1111-4111-8111-111111111111",
    income_line_type_id: TEST_INCOME_LINE_TYPE_ID,
    income_line_type_name: "Parking",
    is_deleted: false,
    long_stay_id: null,
    net_income: "100.00",
    property_id: TEST_PROPERTY_ID,
    refunded_at: null,
    refunded_by: null,
    reservation_id: null,
    tax_breakdown: [],
    transaction_date: testIsoDate(0),
    unit_id: null,
    updated_at: testDateTime(0),
    ...overrides,
  };
}
