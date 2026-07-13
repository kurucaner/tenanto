import {
  type IIncomeImportDuplicateMatchInput,
  INCOME_ENTRIES_LIST_LIMIT,
  type IPropertyReservationsListQuery,
} from "@/packages/shared";

/** Pad duplicate-check range so near-adjacent existing stays are still matched. */
const DUPLICATE_CHECK_DATE_PADDING_DAYS = 3;

function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxIsoDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function buildIncomeImportDuplicateCheckFilters(
  rows: readonly Pick<IIncomeImportDuplicateMatchInput, "checkIn" | "checkOut">[]
): IPropertyReservationsListQuery {
  if (rows.length === 0) {
    return { limit: INCOME_ENTRIES_LIST_LIMIT };
  }

  let minCheckIn = rows[0]?.checkIn ?? "";
  let maxCheckOut = rows[0]?.checkOut ?? "";

  for (const row of rows) {
    minCheckIn = minIsoDate(minCheckIn, row.checkIn);
    maxCheckOut = maxIsoDate(maxCheckOut, row.checkOut);
  }

  return {
    from: addDaysToIsoDate(minCheckIn, -DUPLICATE_CHECK_DATE_PADDING_DAYS),
    limit: INCOME_ENTRIES_LIST_LIMIT,
    to: addDaysToIsoDate(maxCheckOut, DUPLICATE_CHECK_DATE_PADDING_DAYS),
  };
}
