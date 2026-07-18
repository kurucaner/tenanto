import { testDateTime, testIsoDate } from "../dates";
import { buildIncomeLineRow } from "../db-rows/income-line-row";
import { sequentialUuid } from "../ids";

const AMOUNTS = ["100.00", "50.00", "25.00"] as const;

export function buildDescendingIncomeLineRows(): Record<string, unknown>[] {
  return AMOUNTS.map((amount, rowIndex) => {
    const dayOffset = -rowIndex;

    return buildIncomeLineRow({
      amount,
      created_at: testDateTime(dayOffset),
      gross_income: amount,
      id: sequentialUuid(rowIndex + 1),
      net_income: amount,
      transaction_date: testIsoDate(dayOffset),
      updated_at: testDateTime(dayOffset),
    });
  });
}

export { TEST_INCOME_LINE_TYPE_ID } from "../ids";
