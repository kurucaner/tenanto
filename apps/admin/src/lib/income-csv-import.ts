import { incomeImportApi } from "@/lib/api-client";
import { type ISelectedCsvFile, processCsvIncomingFiles } from "@/lib/csv-file-import";
import {
  type IIncomeImportCommitResponse,
  type IIncomeImportParsedRow,
  type IIncomeImportParseResponse,
  INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE,
  INCOME_CSV_IMPORT_MAX_FILES,
} from "@/packages/shared";

export type ISelectedIncomeCsvFile = ISelectedCsvFile;
export type TIncomeCsvFileRejection = "duplicate" | "invalid_type" | "max_count" | "oversized";

const INCOME_CSV_LIMITS = {
  maxBytesPerFile: INCOME_CSV_IMPORT_MAX_BYTES_PER_FILE,
  maxFiles: INCOME_CSV_IMPORT_MAX_FILES,
};

export function processIncomeCsvIncomingFiles(
  currentFiles: ISelectedIncomeCsvFile[],
  incoming: FileList | File[]
): {
  files: ISelectedIncomeCsvFile[];
  rejections: Record<TIncomeCsvFileRejection, boolean>;
} {
  return processCsvIncomingFiles(currentFiles, incoming, INCOME_CSV_LIMITS);
}

export async function parseIncomeCsvFiles(
  propertyId: string,
  files: ISelectedIncomeCsvFile[]
): Promise<IIncomeImportParseResponse> {
  const formData = new FormData();
  for (const entry of files) {
    formData.append("files", entry.file, entry.file.name);
  }
  return incomeImportApi.importParse(propertyId, formData);
}

export async function commitIncomeCsvImport(
  propertyId: string,
  rows: IIncomeImportParsedRow[]
): Promise<IIncomeImportCommitResponse> {
  return incomeImportApi.importCommit(propertyId, { rows });
}
