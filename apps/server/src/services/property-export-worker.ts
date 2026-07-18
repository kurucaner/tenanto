import { type Job, Worker } from "bullmq";

import { exportJobsDb } from "@/db/export-jobs";
import { isExportPermanentFailure } from "@/errors/export-errors";
import {
  PROPERTY_EXPORT_JOB_ATTEMPTS,
  PROPERTY_EXPORT_QUEUE_NAME,
} from "@/lib/property-export-config";
import {
  closePropertyExportQueue,
  type IPropertyExportJobData,
} from "@/queues/property-export-queue";
import { getRedisConnectionOptions } from "@/queues/redis-connection";
import { processPropertyExportJob } from "@/services/property-export/process-export-job";
import { maybePublishExportJobUpdated } from "@/services/property-export/property-export-stream";

import { WinstonLogger } from "./winston";

async function processPropertyExportBullJob(job: Job<IPropertyExportJobData>): Promise<void> {
  await processPropertyExportJob(job.data.jobId);
}

let worker: Worker<IPropertyExportJobData> | null = null;

export function startPropertyExportWorker(): Worker<IPropertyExportJobData> {
  if (worker != null) {
    return worker;
  }

  worker = new Worker<IPropertyExportJobData>(
    PROPERTY_EXPORT_QUEUE_NAME,
    processPropertyExportBullJob,
    {
      connection: getRedisConnectionOptions(),
    }
  );

  worker.on("failed", (job, error) => {
    void (async () => {
      if (job == null) {
        return;
      }

      if (isExportPermanentFailure(error)) {
        return;
      }

      const maxAttempts = job.opts.attempts ?? PROPERTY_EXPORT_JOB_ATTEMPTS;
      if (job.attemptsMade < maxAttempts) {
        return;
      }

      const message = error instanceof Error ? error.message : "Export failed";
      await exportJobsDb.markFailed(job.data.jobId, message);
      await maybePublishExportJobUpdated(job.data.jobId);
      WinstonLogger.error("property_export.worker_job_failed", {
        attemptsMade: job.attemptsMade,
        errorMessage: message,
        jobId: job.data.jobId,
        maxAttempts,
      });
    })();
  });

  return worker;
}

export async function stopPropertyExportWorker(): Promise<void> {
  if (worker != null) {
    await worker.close();
    worker = null;
  }
  await closePropertyExportQueue();
}
