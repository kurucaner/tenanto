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

import { WinstonLogger } from "../winston";

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

async function processExpensesCsvExport(job: IExportJob): Promise<void> {
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
    fileName,
    jobId: job.id,
    propertyId: job.propertyId,
    rowCount,
  });
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

  try {
    if (job.resourceType === ExportResourceType.EXPENSES && job.format === ExportFormat.CSV) {
      await processExpensesCsvExport(job);
      return;
    }

    throw new ExportJobPermanentError(`Unsupported export: ${job.resourceType} as ${job.format}`);
  } catch (error) {
    if (error instanceof ExportRowLimitExceededError || error instanceof ExportJobPermanentError) {
      await exportJobsDb.markFailed(jobId, error.message);
      WinstonLogger.warn("property_export.failed", {
        errorMessage: error.message,
        jobId,
        propertyId: job.propertyId,
      });
      return;
    }

    throw error;
  }
}
