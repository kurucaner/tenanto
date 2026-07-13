import { Queue } from "bullmq";

import {
  TENANT_EMAIL_CAMPAIGN_JOB_ATTEMPTS,
  TENANT_EMAIL_CAMPAIGN_QUEUE_NAME,
} from "@/lib/tenant-email-campaign-config";

import { getRedisConnectionOptions } from "./redis-connection";

export interface ITenantEmailSendJobData {
  campaignId: string;
  recipientId: string;
}

export function buildTenantEmailSendJobId(campaignId: string, recipientId: string): string {
  // BullMQ custom job IDs cannot contain ":".
  return `${campaignId}__${recipientId}`;
}

const ACTIVE_JOB_STATES = new Set(["active", "delayed", "prioritized", "waiting"]);

let queue: Queue<ITenantEmailSendJobData> | null = null;

export function getTenantEmailQueue(): Queue<ITenantEmailSendJobData> {
  if (queue == null) {
    queue = new Queue<ITenantEmailSendJobData>(TENANT_EMAIL_CAMPAIGN_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: TENANT_EMAIL_CAMPAIGN_JOB_ATTEMPTS,
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

export async function ensureTenantEmailSendJobEnqueued(
  campaignId: string,
  recipientId: string
): Promise<boolean> {
  const tenantEmailQueue = getTenantEmailQueue();
  const jobId = buildTenantEmailSendJobId(campaignId, recipientId);
  const existing = await tenantEmailQueue.getJob(jobId);

  if (existing != null) {
    const state = await existing.getState();
    if (ACTIVE_JOB_STATES.has(state)) {
      return false;
    }
    await existing.remove();
  }

  await tenantEmailQueue.add(
    "send-recipient",
    { campaignId, recipientId },
    {
      jobId,
    }
  );

  return true;
}

export async function enqueueTenantEmailSendJobs(
  campaignId: string,
  recipientIds: readonly string[]
): Promise<number> {
  let enqueuedCount = 0;

  for (const recipientId of recipientIds) {
    const enqueued = await ensureTenantEmailSendJobEnqueued(campaignId, recipientId);
    if (enqueued) {
      enqueuedCount += 1;
    }
  }

  return enqueuedCount;
}

export async function closeTenantEmailQueue(): Promise<void> {
  if (queue != null) {
    await queue.close();
    queue = null;
  }
}
