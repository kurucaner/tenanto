import { exportJobsDb } from "@/db/export-jobs";
import { propertyExpensesDb } from "@/db/property-expenses";
import { propertyIncomeEntriesDb } from "@/db/property-income-entries";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import {
  ExportFormat,
  ExportResourceType,
  type IExportJob,
  PROPERTY_EXPORT_FILE_TTL_HOURS,
  type TPropertyExpensesListFilters,
  type TPropertyIncomeEntriesListFilters,
  type TPropertyLongStaysListFilters,
} from "@/packages/shared";
import { putObjectStream } from "@/s3/s3-commands";
import {
  buildExpensesExportFileName,
  createExpensesCsvReadable,
  ExportRowLimitExceededError,
} from "@/services/property-export/expenses-csv-export";
import { uploadExpensesXlsxExport } from "@/services/property-export/expenses-xlsx-export";
import {
  buildIncomeExportFileName,
  createIncomeCsvReadable,
  uploadIncomeXlsxExport,
} from "@/services/property-export/income-table-export";
import {
  buildLeasesExportFileName,
  createLeasesCsvReadable,
  uploadLeasesXlsxExport,
} from "@/services/property-export/leases-table-export";
import { notifyExportReady } from "@/services/property-export/property-export-notifications";
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

async function getExportRowCount(job: IExportJob): Promise<number> {
  if (job.resourceType === ExportResourceType.EXPENSES) {
    const meta = await propertyExpensesDb.getListMetaByProperty(
      job.propertyId,
      job.filters as TPropertyExpensesListFilters,
      false
    );
    return meta.totalCount;
  }

  if (job.resourceType === ExportResourceType.INCOME) {
    const meta = await propertyIncomeEntriesDb.getListMetaByProperty(
      job.propertyId,
      job.filters as TPropertyIncomeEntriesListFilters,
      false
    );
    return meta.totalCount;
  }

  const meta = await propertyLongStaysDb.getListMetaByProperty(
    job.propertyId,
    job.filters as TPropertyLongStaysListFilters
  );
  return meta.totalCount;
}

async function uploadExportArtifact(job: IExportJob): Promise<{ fileName: string; s3Key: string }> {
  const s3Key = buildExportS3Key(job.propertyId, job.id, job.format);

  if (job.resourceType === ExportResourceType.EXPENSES) {
    const filters = job.filters as TPropertyExpensesListFilters;
    const fileName = buildExpensesExportFileName(filters, job.format);
    if (job.format === ExportFormat.CSV) {
      await putObjectStream(s3Key, createExpensesCsvReadable(job.propertyId, filters), "text/csv");
    } else {
      await uploadExpensesXlsxExport(s3Key, job.propertyId, filters);
    }
    return { fileName, s3Key };
  }

  if (job.resourceType === ExportResourceType.INCOME) {
    const filters = job.filters as TPropertyIncomeEntriesListFilters;
    const fileName = buildIncomeExportFileName(filters, job.format);
    if (job.format === ExportFormat.CSV) {
      await putObjectStream(s3Key, createIncomeCsvReadable(job.propertyId, filters), "text/csv");
    } else {
      await uploadIncomeXlsxExport(s3Key, job.propertyId, filters);
    }
    return { fileName, s3Key };
  }

  const filters = job.filters as TPropertyLongStaysListFilters;
  const fileName = buildLeasesExportFileName(filters, job.format);
  if (job.format === ExportFormat.CSV) {
    await putObjectStream(s3Key, createLeasesCsvReadable(job.propertyId, filters), "text/csv");
  } else {
    await uploadLeasesXlsxExport(s3Key, job.propertyId, filters);
  }
  return { fileName, s3Key };
}

async function completeExportJob(job: IExportJob, startedAtMs: number): Promise<void> {
  const { fileName, s3Key } = await uploadExportArtifact(job);
  const rowCount = await getExportRowCount(job);
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
  await notifyExportReady(completed);
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
    await completeExportJob(job, startedAtMs);
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
