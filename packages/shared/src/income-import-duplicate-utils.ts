import { type IIncomeImportParsedRow } from "./property-income-import-types";

export const INCOME_IMPORT_DUPLICATE_WARNING = "Similar stay already exists";
export const INCOME_IMPORT_BATCH_DUPLICATE_WARNING = "Duplicate row in this import";

export interface IIncomeImportDuplicateMatchInput {
  checkIn: string;
  checkOut: string;
  guestName: string;
  unitId: string;
}

export function buildIncomeImportStayDuplicateKey(input: IIncomeImportDuplicateMatchInput): string {
  return `${input.unitId}\0${input.checkIn}\0${input.checkOut}\0${input.guestName.trim().toLowerCase()}`;
}

export function buildIncomeImportDuplicateWarningsByIndex(
  rows: readonly IIncomeImportDuplicateMatchInput[],
  existingStays: readonly IIncomeImportDuplicateMatchInput[]
): Map<number, string> {
  const existingKeys = new Set(existingStays.map((stay) => buildIncomeImportStayDuplicateKey(stay)));
  const batchKeyCounts = new Map<string, number>();
  const warnings = new Map<number, string>();

  for (const [index, row] of rows.entries()) {
    const key = buildIncomeImportStayDuplicateKey(row);

    if (existingKeys.has(key)) {
      warnings.set(index, INCOME_IMPORT_DUPLICATE_WARNING);
      continue;
    }

    const seenCount = batchKeyCounts.get(key) ?? 0;
    if (seenCount > 0) {
      warnings.set(index, INCOME_IMPORT_BATCH_DUPLICATE_WARNING);
    }
    batchKeyCounts.set(key, seenCount + 1);
  }

  return warnings;
}

export function countIncomeImportDuplicateWarnings(
  rows: readonly IIncomeImportParsedRow[],
  existingStays: readonly IIncomeImportDuplicateMatchInput[]
): number {
  return buildIncomeImportDuplicateWarningsByIndex(rows, existingStays).size;
}
