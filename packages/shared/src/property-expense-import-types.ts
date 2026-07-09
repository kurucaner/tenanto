import { ExpenseCategory, type IPropertyExpense, type TExpenseCategory } from "./property-expense-types";

export const EXPENSE_CSV_IMPORT_MAX_FILES = 5;
export const EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE = 1_048_576;
export const EXPENSE_CSV_IMPORT_MAX_ROWS_PER_FILE = 200;
export const EXPENSE_CSV_IMPORT_MAX_ROWS_TOTAL = 500;
export const EXPENSE_CSV_IMPORT_MAX_TEXT_BYTES = 51_200;

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
  category: TExpenseCategory;
  description?: string;
  expenseDate?: string;
  rowIndex: number;
  sourceFileName: string;
  taxFree?: boolean;
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

export const EXPENSE_CATEGORY_LABELS: Record<TExpenseCategory, string> = {
  [ExpenseCategory.AIRBNB_COMMISSION]: "Airbnb commission",
  [ExpenseCategory.BOOKING_COMMISSION]: "Booking commission",
  [ExpenseCategory.CLEANING]: "Cleaning",
  [ExpenseCategory.CREDIT_PAYMENT]: "Credit payment",
  [ExpenseCategory.ELECTRICITY]: "Electricity",
  [ExpenseCategory.EXPEDIA_COMMISSION]: "Expedia commission",
  [ExpenseCategory.FIRE_ALARM]: "Fire alarm",
  [ExpenseCategory.GAS]: "Gas",
  [ExpenseCategory.INSURANCE]: "Insurance",
  [ExpenseCategory.INTERNET]: "Internet",
  [ExpenseCategory.LEGAL_FEE_PERMIT]: "Legal fee / permit",
  [ExpenseCategory.MAINTENANCE]: "Maintenance",
  [ExpenseCategory.MATERIAL]: "Material",
  [ExpenseCategory.MERCHANT_COMMISSION]: "Merchant commission",
  [ExpenseCategory.OTHER]: "Other",
  [ExpenseCategory.PHONE]: "Phone",
  [ExpenseCategory.PROPERTY_TAX]: "Property tax",
  [ExpenseCategory.SALARY]: "Salary",
  [ExpenseCategory.SEWERAGE]: "Sewerage",
  [ExpenseCategory.SUBSCRIPTION]: "Subscription",
  [ExpenseCategory.WASTE_MANAGEMENT]: "Waste management",
  [ExpenseCategory.WATER]: "Water",
};

export function formatExpenseCategoryLabelsForPrompt(): string {
  return Object.entries(EXPENSE_CATEGORY_LABELS)
    .map(([value, label]) => `${value} (${label})`)
    .join(", ");
}
