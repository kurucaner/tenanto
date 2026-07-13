import { expensesApi } from "@/lib/api-client";
import {
  formatCsvRejections,
  type ISelectedCsvFile,
  processCsvIncomingFiles,
  type TCsvFileRejection,
} from "@/lib/csv-file-import";
import {
  EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_FILES,
  type IExpenseImportParseResponse,
} from "@/packages/shared";

export type ISelectedExpenseCsvFile = ISelectedCsvFile;
export type TExpenseCsvFileRejection = TCsvFileRejection;

const EXPENSE_CSV_LIMITS = {
  maxBytesPerFile: EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  maxFiles: EXPENSE_CSV_IMPORT_MAX_FILES,
};

export function processExpenseCsvIncomingFiles(
  currentFiles: ISelectedExpenseCsvFile[],
  incoming: FileList | File[]
): {
  files: ISelectedExpenseCsvFile[];
  rejections: Record<TExpenseCsvFileRejection, boolean>;
} {
  return processCsvIncomingFiles(currentFiles, incoming, EXPENSE_CSV_LIMITS);
}

export function formatExpenseCsvRejections(
  rejections: Record<TExpenseCsvFileRejection, boolean>
): string | null {
  return formatCsvRejections(rejections, EXPENSE_CSV_IMPORT_MAX_FILES);
}

export async function parseExpenseCsvFiles(
  propertyId: string,
  files: ISelectedExpenseCsvFile[]
): Promise<IExpenseImportParseResponse> {
  const formData = new FormData();
  for (const entry of files) {
    formData.append("files", entry.file, entry.file.name);
  }
  return expensesApi.importParse(propertyId, formData);
}
