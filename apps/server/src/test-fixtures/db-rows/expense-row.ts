import { testDateTime, testIsoDate } from "../dates";
import {
  TEST_EXPENSE_CATEGORY_ID_1,
  TEST_EXPENSE_CATEGORY_ID_2,
  TEST_PROPERTY_ID,
} from "../ids";

export type TExpenseRowOverrides = Record<string, unknown>;

export function buildExpenseRow(overrides: TExpenseRowOverrides = {}): Record<string, unknown> {
  return {
    amount: "100.00",
    category_id: TEST_EXPENSE_CATEGORY_ID_1,
    category_name: "Cleaning",
    created_at: testDateTime(0),
    deleted_at: null,
    description: "Older same date",
    expense_date: testIsoDate(0),
    id: "11111111-1111-4111-8111-111111111111",
    is_annual_amount: false,
    is_deleted: false,
    property_id: TEST_PROPERTY_ID,
    cash_expense: false,
    updated_at: testDateTime(0),
    ...overrides,
  };
}

export { TEST_EXPENSE_CATEGORY_ID_1, TEST_EXPENSE_CATEGORY_ID_2 };
