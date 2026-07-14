import { exportJobsDb } from "@/db/export-jobs";
import {
  PROPERTY_EXPORT_PROCESSING_TIMEOUT_MESSAGE,
  PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS,
} from "@/lib/property-export-config";
import { deleteObject } from "@/s3/s3-commands";
import { maybePublishExportJobUpdated } from "@/services/property-export/property-export-stream";

import { WinstonLogger } from "../winston";

export function buildProcessingTimeoutCutoff(
  nowMs = Date.now(),
  timeoutMs = PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS
): Date {
  return new Date(nowMs - timeoutMs);
}

/**
 * Marks long-running `processing` jobs as `failed`.
 * Runs on worker startup and can be invoked from ops scripts.
 */
export async function failTimedOutPropertyExports(
  nowMs = Date.now(),
  timeoutMs = PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS
): Promise<number> {
  const cutoff = buildProcessingTimeoutCutoff(nowMs, timeoutMs);
  const jobIds = await exportJobsDb.listTimedOutProcessingJobIds(cutoff);
  let failedCount = 0;

  for (const jobId of jobIds) {
    const failed = await exportJobsDb.markFailed(jobId, PROPERTY_EXPORT_PROCESSING_TIMEOUT_MESSAGE);
    if (failed == null) {
      continue;
    }

    failedCount += 1;
    await maybePublishExportJobUpdated(jobId);
    WinstonLogger.warn("property_export.timed_out", {
      format: failed.format,
      jobId,
      propertyId: failed.propertyId,
      resourceType: failed.resourceType,
      timeoutMs,
    });
  }

  if (failedCount > 0) {
    WinstonLogger.info("property_export.timeout_sweep", {
      cutoff: cutoff.toISOString(),
      failedCount,
      timeoutMs,
    });
  }

  return failedCount;
}

/**
 * Marks completed exports past `expires_at` as `expired` and best-effort deletes S3 objects.
 * Primary TTL enforcement — complement with an S3 lifecycle rule on `exports/` in production.
 */
export async function expireCompletedPropertyExports(): Promise<number> {
  const rows = await exportJobsDb.listPastExpiryCompletedJobs();
  let expiredCount = 0;

  for (const row of rows) {
    if (row.s3Key != null && row.s3Key !== "") {
      try {
        await deleteObject(row.s3Key);
      } catch (error) {
        WinstonLogger.warn("property_export.s3_delete_failed", {
          errorMessage: error instanceof Error ? error.message : String(error),
          jobId: row.id,
          propertyId: row.propertyId,
          s3Key: row.s3Key,
        });
      }
    }

    const expired = await exportJobsDb.markExpired(row.id);
    if (!expired) {
      continue;
    }

    expiredCount += 1;
    await maybePublishExportJobUpdated(row.id);
    WinstonLogger.info("property_export.expired", {
      jobId: row.id,
      propertyId: row.propertyId,
    });
  }

  if (expiredCount > 0) {
    WinstonLogger.info("property_export.expiry_sweep", { expiredCount });
  }

  return expiredCount;
}

/**
 * Startup/maintenance bundle: fail timed-out processing jobs before re-enqueueing stuck work.
 */
export async function runPropertyExportMaintenance(): Promise<{
  expiredCount: number;
  timedOutCount: number;
}> {
  const timedOutCount = await failTimedOutPropertyExports();
  const expiredCount = await expireCompletedPropertyExports();
  return { expiredCount, timedOutCount };
}
