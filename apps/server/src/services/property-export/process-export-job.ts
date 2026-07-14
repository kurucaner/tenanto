import { exportJobsDb } from "@/db/export-jobs";
import { propertyExpensesDb } from "@/db/property-expenses";
import {
  ExportFormat,
  ExportResourceType,
  type IExportJob,
  PROPERTY_EXPORT_FILE_TTL_HOURS,
  type TPropertyExpensesListFilters,
} from "@/packages/shared";
import { putObjectStream } from "@/s3/s3-commands";
import {
  buildExpensesExportFileName,
  createExpensesCsvReadable,
  ExportRowLimitExceededError,
} from "@/services/property-export/expenses-csv-export";
import { maybePublishExportJobUpdated } from "@/services/property-export/property-export-stream";

import { WinstonLogger } from "../winston";

/**
 * Failure modes handled here and in the worker/maintenance layer:
 * - Permanent validation errors → `failed` (no Bull retry)
 * - Row cap exceeded during stream → `failed`
 * - Transient S3/DB errors → Bull retry; terminal attempt → `failed` in worker `failed` handler
 * - Processing timeout (stale `updated_at`) → `failed` via maintenance sweep
 * - Completed past `expires_at` → `expired` via expiry cron (download blocked)
 */

export class ExportJobPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportJobPermanentError";
  }
}

function buildExportS3Key(propertyId: string, jobId: string, format: IExportJob["format"]): string {
  return `exports/${propertyId}/${jobId}.${format}`;
}

function buildExpiresAt(): Date {
  return new Date(Date.now() + PROPERTY_EXPORT_FILE_TTL_HOURS * 60 * 60 * 1000);
}

async function processExpensesCsvExport(job: IExportJob, startedAtMs: number): Promise<void> {
  const filters = job.filters as TPropertyExpensesListFilters;
  const s3Key = buildExportS3Key(job.propertyId, job.id, ExportFormat.CSV);
  const fileName = buildExpensesExportFileName(filters);
  const body = createExpensesCsvReadable(job.propertyId, filters);

  await putObjectStream(s3Key, body, "text/csv");

  const meta = await propertyExpensesDb.getListMetaByProperty(job.propertyId, filters, false);
  const rowCount = meta.totalCount;
  const expiresAt = buildExpiresAt();

  const completed = await exportJobsDb.markCompleted(job.id, {
    expiresAt,
    fileName,
    rowCount,
    s3Key,
  });

  if (completed == null) {
    throw new ExportJobPermanentError("Export job is no longer processing");
  }

  WinstonLogger.info("property_export.completed", {
    durationMs: Date.now() - startedAtMs,
    fileName,
    format: job.format,
    jobId: job.id,
    propertyId: job.propertyId,
    resourceType: job.resourceType,
    rowCount,
  });

  await maybePublishExportJobUpdated(job.id);
}

export async function processPropertyExportJob(jobId: string): Promise<void> {
  const existing = await exportJobsDb.findById(jobId);
  if (
    existing == null ||
    existing.status === "completed" ||
    existing.status === "failed" ||
    existing.status === "expired"
  ) {
    return;
  }

  const claimed = await exportJobsDb.markProcessing(jobId);
  if (claimed == null) {
    return;
  }

  const job = claimed;
  const startedAtMs = Date.now();

  await maybePublishExportJobUpdated(jobId);

  try {
    if (job.resourceType === ExportResourceType.EXPENSES && job.format === ExportFormat.CSV) {
      await processExpensesCsvExport(job, startedAtMs);
      return;
    }

    throw new ExportJobPermanentError(`Unsupported export: ${job.resourceType} as ${job.format}`);
  } catch (error) {
    if (error instanceof ExportRowLimitExceededError || error instanceof ExportJobPermanentError) {
      await exportJobsDb.markFailed(jobId, error.message);
      await maybePublishExportJobUpdated(jobId);
      WinstonLogger.warn("property_export.failed", {
        durationMs: Date.now() - startedAtMs,
        errorMessage: error.message,
        format: job.format,
        jobId,
        propertyId: job.propertyId,
        resourceType: job.resourceType,
      });
      return;
    }

    throw error;
  }
}
