import { exportJobsDb } from "@/db/export-jobs";
import { ExportJobStatus, type TExportJobStatus } from "@/packages/shared";

import { notificationStreamHub } from "../notification-stream-hub";

const PROGRESS_EMIT_INTERVAL_MS = 2_000;

const throttleByJob = new Map<string, number>();

function isTerminalExportJobStatus(status: TExportJobStatus): boolean {
  return (
    status === ExportJobStatus.COMPLETED ||
    status === ExportJobStatus.EXPIRED ||
    status === ExportJobStatus.FAILED
  );
}

export function shouldEmitExportJobUpdate(
  jobId: string,
  status: TExportJobStatus,
  nowMs = Date.now()
): boolean {
  if (isTerminalExportJobStatus(status)) {
    throttleByJob.delete(jobId);
    return true;
  }

  if (status === ExportJobStatus.PROCESSING) {
    const previousEmitAtMs = throttleByJob.get(jobId);
    if (previousEmitAtMs == null || nowMs - previousEmitAtMs >= PROGRESS_EMIT_INTERVAL_MS) {
      throttleByJob.set(jobId, nowMs);
      return true;
    }
    return false;
  }

  return true;
}

export function resetExportJobStreamThrottle(jobId?: string): void {
  if (jobId == null) {
    throttleByJob.clear();
    return;
  }
  throttleByJob.delete(jobId);
}

export async function maybePublishExportJobUpdated(jobId: string): Promise<void> {
  const job = await exportJobsDb.findById(jobId);
  if (job == null) {
    return;
  }

  if (!shouldEmitExportJobUpdate(jobId, job.status)) {
    return;
  }

  await notificationStreamHub.publishExportJobUpdated({
    format: job.format,
    jobId: job.id,
    propertyId: job.propertyId,
    resourceType: job.resourceType,
    rowCount: job.rowCount ?? undefined,
    status: job.status,
    userId: job.createdBy,
  });
}
