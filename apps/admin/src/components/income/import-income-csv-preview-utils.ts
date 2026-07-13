import { type IIncomeImportParsedRow } from "@/packages/shared";

export const AMOUNT_INPUT_CLASS_NAME = "min-w-[7.5rem] tabular-nums text-right";
export const TABLE_AMOUNT_INPUT_CLASS_NAME = "w-full max-w-full min-w-0 tabular-nums text-right";
export const TABLE_SELECT_CLASS_NAME = "w-full max-w-full min-w-0";
export const STICKY_ACTIONS_CELL_CLASS_NAME = "sticky right-0 z-10 bg-background";
export const IMPORT_INCOME_CSV_PREVIEW_TABLE_CLASS_NAME = "min-w-[1800px] table-fixed";

export function getImportIncomePreviewRowValidationError(
  row: IIncomeImportParsedRow
): string | null {
  return row.validationError ?? null;
}

export function getImportIncomePreviewRowDuplicateWarning(
  duplicateWarningsByIndex: ReadonlyMap<number, string>,
  index: number
): string | null {
  return duplicateWarningsByIndex.get(index) ?? null;
}

export interface IIncomeImportPreviewRowListItem {
  row: IIncomeImportParsedRow;
  sourceIndex: number;
}

export function sortIncomeImportPreviewRowsByAttention(
  rows: readonly IIncomeImportParsedRow[]
): IIncomeImportPreviewRowListItem[] {
  return rows
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .sort((left, right) => {
      const leftHasError = getImportIncomePreviewRowValidationError(left.row) !== null;
      const rightHasError = getImportIncomePreviewRowValidationError(right.row) !== null;

      if (leftHasError !== rightHasError) {
        return leftHasError ? -1 : 1;
      }

      return left.sourceIndex - right.sourceIndex;
    });
}
