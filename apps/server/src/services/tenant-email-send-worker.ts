import { type Job, Worker } from "bullmq";

import { propertyTenantEmailCampaignsDb } from "@/db/property-tenant-email-campaigns";
import {
  TENANT_EMAIL_CAMPAIGN_JOB_ATTEMPTS,
  TENANT_EMAIL_CAMPAIGN_QUEUE_NAME,
  TENANT_EMAIL_CAMPAIGN_RATE_LIMIT_DURATION_MS,
  TENANT_EMAIL_CAMPAIGN_RATE_LIMIT_MAX,
} from "@/lib/tenant-email-campaign-config";
import { TenantEmailRecipientStatus } from "@/packages/shared";
import { getRedisConnectionOptions } from "@/queues/redis-connection";
import { closeTenantEmailQueue, type ITenantEmailSendJobData } from "@/queues/tenant-email-queue";
import {
  getSesErrorMessage,
  isPermanentSesError,
  isRetryableSesError,
} from "@/ses/ses-error-utils";
import { sendTenantCampaignEmail } from "@/ses/transactional-emails";

async function processTenantEmailSendJob(job: Job<ITenantEmailSendJobData>): Promise<void> {
  const { campaignId, recipientId } = job.data;

  const row = await propertyTenantEmailCampaignsDb.getSendRecipientRow(recipientId);
  if (!row || row.status !== TenantEmailRecipientStatus.QUEUED) {
    return;
  }

  await propertyTenantEmailCampaignsDb.markCampaignSendingIfQueued(campaignId);

  try {
    await sendTenantCampaignEmail(row.email, {
      htmlBody: row.htmlBody,
      propertyName: row.propertyName,
      subject: row.subject,
      textBody: row.textBody,
    });

    await propertyTenantEmailCampaignsDb.markRecipientSent(recipientId);
  } catch (error) {
    const message = getSesErrorMessage(error);

    if (isRetryableSesError(error) && !isPermanentSesError(error)) {
      await propertyTenantEmailCampaignsDb.incrementRecipientAttempt(recipientId, message);
      throw error;
    }

    await propertyTenantEmailCampaignsDb.markRecipientFailed(recipientId, message);
  } finally {
    await propertyTenantEmailCampaignsDb.refreshCampaignCompletion(campaignId);
  }
}

let worker: Worker<ITenantEmailSendJobData> | null = null;

export function startTenantEmailSendWorker(): Worker<ITenantEmailSendJobData> {
  if (worker != null) {
    return worker;
  }

  worker = new Worker<ITenantEmailSendJobData>(
    TENANT_EMAIL_CAMPAIGN_QUEUE_NAME,
    processTenantEmailSendJob,
    {
      connection: getRedisConnectionOptions(),
      limiter: {
        duration: TENANT_EMAIL_CAMPAIGN_RATE_LIMIT_DURATION_MS,
        max: TENANT_EMAIL_CAMPAIGN_RATE_LIMIT_MAX,
      },
    }
  );

  worker.on("failed", (job, error) => {
    void (async () => {
      if (!job) {
        return;
      }

      const maxAttempts = job.opts.attempts ?? TENANT_EMAIL_CAMPAIGN_JOB_ATTEMPTS;
      if (job.attemptsMade < maxAttempts) {
        return;
      }

      const { campaignId, recipientId } = job.data;
      const row = await propertyTenantEmailCampaignsDb.getSendRecipientRow(recipientId);
      if (!row || row.status !== TenantEmailRecipientStatus.QUEUED) {
        return;
      }

      await propertyTenantEmailCampaignsDb.markRecipientFailed(
        recipientId,
        getSesErrorMessage(error)
      );
      await propertyTenantEmailCampaignsDb.refreshCampaignCompletion(campaignId);
    })().catch((handlerError) => {
      console.error("[tenant-email-worker] failed-handler error", handlerError);
    });

    console.error("[tenant-email-worker] job failed", {
      campaignId: job?.data.campaignId,
      error: getSesErrorMessage(error),
      recipientId: job?.data.recipientId,
    });
  });

  return worker;
}

export async function stopTenantEmailSendWorker(): Promise<void> {
  if (worker != null) {
    await worker.close();
    worker = null;
  }
  await closeTenantEmailQueue();
}
