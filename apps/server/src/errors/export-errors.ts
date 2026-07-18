import { createDomainError, type DomainError, isDomainError } from "@/lib/domain-error";
import { PROPERTY_EXPORT_DUPLICATE_MESSAGE } from "@/lib/property-export-config";
import {
  HttpStatus,
  PROPERTY_EXPORT_EMPTY_MESSAGE,
  PROPERTY_EXPORT_MAX_ROWS,
} from "@/packages/shared";

export const ExportErrorCode = {
  DUPLICATE: "PROPERTY_EXPORT_DUPLICATE",
  EMPTY: "PROPERTY_EXPORT_EMPTY",
  JOB_PERMANENT: "PROPERTY_EXPORT_JOB_PERMANENT",
  ROW_LIMIT: "PROPERTY_EXPORT_ROW_LIMIT",
  ROW_LIMIT_EXCEEDED: "PROPERTY_EXPORT_ROW_LIMIT_EXCEEDED",
  VALIDATION: "PROPERTY_EXPORT_VALIDATION",
} as const;

export type TExportErrorCode = (typeof ExportErrorCode)[keyof typeof ExportErrorCode];

const EXPORT_ERROR_CODES = new Set<string>(Object.values(ExportErrorCode));

export function isExportDomainError(error: unknown): error is DomainError {
  return isDomainError(error) && EXPORT_ERROR_CODES.has(error.code);
}

export function isExportPermanentFailure(error: unknown): error is DomainError {
  return (
    isDomainError(error) &&
    (error.code === ExportErrorCode.ROW_LIMIT_EXCEEDED ||
      error.code === ExportErrorCode.JOB_PERMANENT)
  );
}

export function getPropertyExportDuplicateJobId(error: unknown): string | null {
  if (isDomainError(error) && error.code === ExportErrorCode.DUPLICATE) {
    const jobId = error.body?.jobId;
    return typeof jobId === "string" ? jobId : null;
  }
  return null;
}

export function propertyExportDuplicateError(existingJobId: string): DomainError {
  return createDomainError(
    ExportErrorCode.DUPLICATE,
    PROPERTY_EXPORT_DUPLICATE_MESSAGE,
    HttpStatus.CONFLICT,
    { jobId: existingJobId }
  );
}

export function propertyExportEmptyError(): DomainError {
  return createDomainError(
    ExportErrorCode.EMPTY,
    PROPERTY_EXPORT_EMPTY_MESSAGE,
    HttpStatus.BAD_REQUEST
  );
}

export function propertyExportRowLimitError(matchedCount: number): DomainError {
  return createDomainError(
    ExportErrorCode.ROW_LIMIT,
    `Export exceeds the maximum of ${PROPERTY_EXPORT_MAX_ROWS.toLocaleString()} rows (found ${matchedCount.toLocaleString()}). Narrow your date range or filters and try again.`,
    HttpStatus.BAD_REQUEST,
    { matchedCount }
  );
}

export function propertyExportValidationError(message: string): DomainError {
  return createDomainError(ExportErrorCode.VALIDATION, message, HttpStatus.BAD_REQUEST);
}

export function exportRowLimitExceededError(matchedCount: number, maxRows: number): DomainError {
  return createDomainError(
    ExportErrorCode.ROW_LIMIT_EXCEEDED,
    `Export exceeded the maximum of ${maxRows.toLocaleString()} rows (found ${matchedCount.toLocaleString()}). Narrow your date range or filters and try again.`,
    HttpStatus.BAD_REQUEST,
    { matchedCount, maxRows }
  );
}

export function exportJobPermanentError(message: string): DomainError {
  return createDomainError(ExportErrorCode.JOB_PERMANENT, message, HttpStatus.BAD_REQUEST);
}
