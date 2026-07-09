import { expensesApi } from "@/lib/api-client";
import {
  EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE,
  EXPENSE_CSV_IMPORT_MAX_FILES,
  type IExpenseImportParseResponse,
} from "@/packages/shared";

const CSV_MIME_TYPES = new Set([
  "application/csv",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

export type TExpenseCsvFileRejection = "duplicate" | "invalid_type" | "max_count" | "oversized";

export interface ISelectedExpenseCsvFile {
  file: File;
  id: string;
}

function createFileId(): string {
  return crypto.randomUUID();
}

function isCsvFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".csv")) {
    return false;
  }
  return file.type === "" || CSV_MIME_TYPES.has(file.type);
}

function isDuplicateFile(files: ISelectedExpenseCsvFile[], file: File): boolean {
  return files.some((entry) => entry.file.name === file.name && entry.file.size === file.size);
}

export function processExpenseCsvIncomingFiles(
  currentFiles: ISelectedExpenseCsvFile[],
  incoming: FileList | File[]
): {
  files: ISelectedExpenseCsvFile[];
  rejections: Record<TExpenseCsvFileRejection, boolean>;
} {
  const rejections: Record<TExpenseCsvFileRejection, boolean> = {
    duplicate: false,
    invalid_type: false,
    max_count: false,
    oversized: false,
  };

  const nextFiles = [...currentFiles];
  for (const file of incoming) {
    if (!isCsvFile(file)) {
      rejections.invalid_type = true;
      continue;
    }
    if (file.size > EXPENSE_CSV_IMPORT_MAX_BYTES_PER_FILE) {
      rejections.oversized = true;
      continue;
    }
    if (isDuplicateFile(nextFiles, file)) {
      rejections.duplicate = true;
      continue;
    }
    if (nextFiles.length >= EXPENSE_CSV_IMPORT_MAX_FILES) {
      rejections.max_count = true;
      continue;
    }
    nextFiles.push({ file, id: createFileId() });
  }

  return { files: nextFiles, rejections };
}

export function formatExpenseCsvRejections(
  rejections: Record<TExpenseCsvFileRejection, boolean>
): string | null {
  const messages: string[] = [];
  if (rejections.invalid_type) messages.push("Only .csv files are supported");
  if (rejections.oversized) messages.push("Each file must be 1 MB or smaller");
  if (rejections.duplicate) messages.push("Duplicate files were skipped");
  if (rejections.max_count)
    messages.push(`At most ${EXPENSE_CSV_IMPORT_MAX_FILES} files are allowed`);
  return messages.length > 0 ? messages.join(". ") : null;
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
