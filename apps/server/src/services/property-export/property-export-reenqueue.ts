import { exportJobsDb } from "@/db/export-jobs";
import { ensurePropertyExportJobEnqueued } from "@/queues/property-export-queue";

import { WinstonLogger } from "../winston";

export async function reenqueuePropertyExportJob(jobId: string): Promise<boolean> {
  const job = await exportJobsDb.findById(jobId);
  if (job == null) {
    return false;
  }

  if (job.status !== "pending" && job.status !== "processing") {
    return false;
  }

  const enqueued = await ensurePropertyExportJobEnqueued(jobId);
  if (enqueued) {
    WinstonLogger.info("property_export.reenqueued", {
      jobId,
      propertyId: job.propertyId,
      status: job.status,
    });
  }

  return enqueued;
}

export async function reenqueueAllStuckPropertyExports(): Promise<number> {
  const jobIds = await exportJobsDb.listStuckJobIds();
  let enqueuedCount = 0;

  for (const jobId of jobIds) {
    const enqueued = await reenqueuePropertyExportJob(jobId);
    if (enqueued) {
      enqueuedCount += 1;
    }
  }

  if (enqueuedCount > 0) {
    WinstonLogger.info("property_export.startup_reenqueue", {
      enqueuedCount,
      jobCount: jobIds.length,
    });
  }

  return enqueuedCount;
}

export async function enqueuePropertyExportJob(jobId: string): Promise<void> {
  const enqueued = await ensurePropertyExportJobEnqueued(jobId);
  if (!enqueued) {
    WinstonLogger.warn("property_export.enqueue_skipped", { jobId });
  }
}
