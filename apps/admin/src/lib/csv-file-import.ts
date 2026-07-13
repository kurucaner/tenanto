const CSV_MIME_TYPES = new Set([
  "application/csv",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

export type TCsvFileRejection = "duplicate" | "invalid_type" | "max_count" | "oversized";

export interface ISelectedCsvFile {
  file: File;
  id: string;
}

export interface ICsvImportLimits {
  maxBytesPerFile: number;
  maxFiles: number;
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

function isDuplicateFile(files: ISelectedCsvFile[], file: File): boolean {
  return files.some((entry) => entry.file.name === file.name && entry.file.size === file.size);
}

export function processCsvIncomingFiles(
  currentFiles: ISelectedCsvFile[],
  incoming: FileList | File[],
  limits: ICsvImportLimits
): {
  files: ISelectedCsvFile[];
  rejections: Record<TCsvFileRejection, boolean>;
} {
  const rejections: Record<TCsvFileRejection, boolean> = {
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
    if (file.size > limits.maxBytesPerFile) {
      rejections.oversized = true;
      continue;
    }
    if (isDuplicateFile(nextFiles, file)) {
      rejections.duplicate = true;
      continue;
    }
    if (nextFiles.length >= limits.maxFiles) {
      rejections.max_count = true;
      continue;
    }
    nextFiles.push({ file, id: createFileId() });
  }

  return { files: nextFiles, rejections };
}

export function formatCsvRejections(
  rejections: Record<TCsvFileRejection, boolean>,
  maxFiles: number
): string | null {
  const messages: string[] = [];
  if (rejections.invalid_type) messages.push("Only .csv files are supported");
  if (rejections.oversized) messages.push("Each file must be 1 MB or smaller");
  if (rejections.duplicate) messages.push("Duplicate files were skipped");
  if (rejections.max_count) messages.push(`At most ${maxFiles} files are allowed`);
  return messages.length > 0 ? messages.join(". ") : null;
}
