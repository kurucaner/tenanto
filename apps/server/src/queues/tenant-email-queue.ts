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

export async function enqueueTenantEmailSendJobs(
  campaignId: string,
  recipientIds: readonly string[]
): Promise<void> {
  const tenantEmailQueue = getTenantEmailQueue();

  await tenantEmailQueue.addBulk(
    recipientIds.map((recipientId) => ({
      data: { campaignId, recipientId },
      name: "send-recipient",
      opts: {
        jobId: buildTenantEmailSendJobId(campaignId, recipientId),
      },
    }))
  );
}

export async function closeTenantEmailQueue(): Promise<void> {
  if (queue != null) {
    await queue.close();
    queue = null;
  }
}
