import { testDateTime, testIsoDate } from "../dates";
import {
  buildExpenseRow,
  TEST_EXPENSE_CATEGORY_ID_1,
  TEST_EXPENSE_CATEGORY_ID_2,
} from "../db-rows/expense-row";
import { sequentialUuid } from "../ids";

const EXPENSE_PAGE_SPECS = [
  {
    amount: "100.00",
    categoryId: TEST_EXPENSE_CATEGORY_ID_1,
    categoryName: "Cleaning",
    dayOffset: 0,
    description: "Older same date",
    expenseDate: testIsoDate(0),
  },
  {
    amount: "50.00",
    categoryId: TEST_EXPENSE_CATEGORY_ID_2,
    categoryName: "Other",
    dayOffset: -1,
    description: "Earlier date",
    expenseDate: testIsoDate(-1),
  },
  {
    amount: "25.00",
    categoryId: TEST_EXPENSE_CATEGORY_ID_2,
    categoryName: "Other",
    dayOffset: -2,
    description: "No date",
    expenseDate: null,
  },
] as const;

export function buildDescendingExpenseRows(): Record<string, unknown>[] {
  return EXPENSE_PAGE_SPECS.map((spec, rowIndex) =>
    buildExpenseRow({
      amount: spec.amount,
      category_id: spec.categoryId,
      category_name: spec.categoryName,
      created_at: testDateTime(spec.dayOffset),
      description: spec.description,
      expense_date: spec.expenseDate,
      id: sequentialUuid(rowIndex + 1),
      updated_at: testDateTime(spec.dayOffset),
    })
  );
}

export { TEST_EXPENSE_CATEGORY_ID_1, TEST_EXPENSE_CATEGORY_ID_2 };
