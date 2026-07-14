import { Queue } from "bullmq";

import {
  PROPERTY_EXPORT_JOB_ATTEMPTS,
  PROPERTY_EXPORT_QUEUE_NAME,
} from "@/lib/property-export-config";

import { getRedisConnectionOptions } from "./redis-connection";

export interface IPropertyExportJobData {
  jobId: string;
}

export function buildPropertyExportJobId(jobId: string): string {
  return jobId;
}

const ACTIVE_JOB_STATES = new Set(["active", "delayed", "prioritized", "waiting"]);

let queue: Queue<IPropertyExportJobData> | null = null;

export function getPropertyExportQueue(): Queue<IPropertyExportJobData> {
  if (queue == null) {
    queue = new Queue<IPropertyExportJobData>(PROPERTY_EXPORT_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: PROPERTY_EXPORT_JOB_ATTEMPTS,
        backoff: {
          delay: 5000,
          type: "exponential",
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  return queue;
}

export async function ensurePropertyExportJobEnqueued(jobId: string): Promise<boolean> {
  const exportQueue = getPropertyExportQueue();
  const bullJobId = buildPropertyExportJobId(jobId);
  const existing = await exportQueue.getJob(bullJobId);

  if (existing != null) {
    const state = await existing.getState();
    if (ACTIVE_JOB_STATES.has(state)) {
      return false;
    }
    await existing.remove();
  }

  await exportQueue.add("process-export", { jobId }, { jobId: bullJobId });

  return true;
}

export async function closePropertyExportQueue(): Promise<void> {
  if (queue != null) {
    await queue.close();
    queue = null;
  }
}
