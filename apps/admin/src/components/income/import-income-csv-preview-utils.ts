import { type IIncomeImportParsedRow } from "@/packages/shared";

export const AMOUNT_INPUT_CLASS_NAME = "min-w-[7.5rem] tabular-nums text-right";
export const TABLE_AMOUNT_INPUT_CLASS_NAME = "w-full max-w-full min-w-0 tabular-nums text-right";
export const STICKY_NET_CELL_CLASS_NAME =
  "sticky right-[88px] z-10 border-l bg-background pr-3 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]";
export const STICKY_ACTIONS_CELL_CLASS_NAME = "sticky right-0 z-10 bg-background";
export const IMPORT_INCOME_CSV_PREVIEW_TABLE_CLASS_NAME = "min-w-[1680px] table-fixed";

export function getImportIncomePreviewRowValidationError(
  row: IIncomeImportParsedRow
): string | null {
  return row.validationError ?? null;
}
