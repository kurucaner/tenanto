import { type IExpenseImportParsedRow, validateExpenseCategoryFields } from "@/packages/shared";

export const AMOUNT_INPUT_CLASS_NAME = "min-w-[7.5rem] tabular-nums text-right";
export const STICKY_AMOUNT_CELL_CLASS_NAME =
  "sticky right-[88px] z-10 border-l bg-background shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]";
export const STICKY_ACTIONS_CELL_CLASS_NAME = "sticky right-0 z-10 bg-background";
export const IMPORT_EXPENSE_CSV_PREVIEW_TABLE_CLASS_NAME = "min-w-[1040px] table-fixed";

export function getImportPreviewRowValidationError(row: IExpenseImportParsedRow): string | null {
  if (row.validationError) {
    return row.validationError;
  }

  const categoryError = validateExpenseCategoryFields(row.category, {
    description: row.description,
  });
  if (categoryError) {
    return categoryError;
  }

  if (!Number.isFinite(row.amount) || row.amount < 0) {
    return "Amount must be a non-negative number";
  }

  return null;
}
