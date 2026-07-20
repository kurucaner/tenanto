import type { IPropertyExpense } from "./property-expense-types";

export const EXPENSE_CSV_IMPORT_MAX_FILES = 5;
export const EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE = 1_048_576;
export const EXPENSE_CSV_IMPORT_MAX_ROWS_PER_FILE = 2000;
export const EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL = 2000;

export type TExpenseImportFileStatus = "error" | "irrelevant" | "parsed";

export interface IExpenseCsvExtractedRow {
  amount: number;
  bankCategory?: string;
  bankType?: string;
  description: string;
  expenseDate?: string;
  rowIndex: number;
  sourceFileName: string;
}

export interface IExpenseImportParsedRow {
  amount: number;
  categoryId: string;
  description?: string;
  expenseDate?: string;
  rowIndex: number;
  sourceFileName: string;
  cashExpense?: boolean;
  validationError?: string;
}

export interface IExpenseImportFileResult {
  fileName: string;
  message?: string;
  rows?: IExpenseImportParsedRow[];
  status: TExpenseImportFileStatus;
}

export interface IExpenseImportParseResponse {
  files: IExpenseImportFileResult[];
}

export interface IExpenseImportCommitBody {
  rows: IExpenseImportParsedRow[];
}

export interface IExpenseImportCommitResponse {
  createdCount: number;
  expenses: IPropertyExpense[];
}
