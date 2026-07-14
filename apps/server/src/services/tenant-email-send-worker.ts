import { type Job, Worker } from "bullmq";

import { emailUnsubscribesDb } from "@/db/email-unsubscribes";
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
  logTenantEmailRecipientFailed,
  logTenantEmailRecipientSent,
  logTenantEmailRecipientSkipped,
  logTenantEmailWorkerJobFailed,
} from "@/services/tenant-email-campaign-observability";
import { maybePublishTenantEmailCampaignUpdated } from "@/services/tenant-email-campaign-stream";
import {
  getSesErrorMessage,
  isPermanentSesError,
  isRetryableSesError,
} from "@/ses/ses-error-utils";
import { sendTenantCampaignEmail } from "@/ses/transactional-emails";

const UNSUBSCRIBED_SKIP_REASON = "Recipient unsubscribed";

async function finalizeRecipientAttempt(campaignId: string): Promise<void> {
  const transitionedToTerminal =
    await propertyTenantEmailCampaignsDb.refreshCampaignCompletion(campaignId);
  await maybePublishTenantEmailCampaignUpdated(campaignId, { transitionedToTerminal });
}

async function processTenantEmailSendJob(job: Job<ITenantEmailSendJobData>): Promise<void> {
  const { campaignId, recipientId } = job.data;

  const row = await propertyTenantEmailCampaignsDb.getSendRecipientRow(recipientId);
  if (!row || row.status !== TenantEmailRecipientStatus.QUEUED) {
    return;
  }

  await propertyTenantEmailCampaignsDb.markCampaignSendingIfQueued(campaignId);

  const isUnsubscribed = await emailUnsubscribesDb.isUnsubscribed(row.email);
  if (isUnsubscribed) {
    await propertyTenantEmailCampaignsDb.markRecipientSkipped(
      recipientId,
      UNSUBSCRIBED_SKIP_REASON
    );
    logTenantEmailRecipientSkipped({
      campaignId,
      propertyId: row.propertyId,
      reason: UNSUBSCRIBED_SKIP_REASON,
      recipientId,
    });
    await finalizeRecipientAttempt(campaignId);
    return;
  }

  try {
    await sendTenantCampaignEmail(row.email, {
      htmlBody: row.htmlBody,
      propertyName: row.propertyName,
      subject: row.subject,
      textBody: row.textBody,
    });

    await propertyTenantEmailCampaignsDb.markRecipientSent(recipientId);
    logTenantEmailRecipientSent({
      campaignId,
      propertyId: row.propertyId,
      recipientId,
    });
  } catch (error) {
    const message = getSesErrorMessage(error);

    if (isRetryableSesError(error) && !isPermanentSesError(error)) {
      await propertyTenantEmailCampaignsDb.incrementRecipientAttempt(recipientId, message);
      throw error;
    }

    await propertyTenantEmailCampaignsDb.markRecipientFailed(recipientId, message);
    logTenantEmailRecipientFailed({
      campaignId,
      errorMessage: message,
      propertyId: row.propertyId,
      recipientId,
    });
  } finally {
    await finalizeRecipientAttempt(campaignId);
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

      const message = getSesErrorMessage(error);
      await propertyTenantEmailCampaignsDb.markRecipientFailed(recipientId, message);
      logTenantEmailRecipientFailed({
        campaignId,
        errorMessage: message,
        propertyId: row.propertyId,
        recipientId,
      });
      await finalizeRecipientAttempt(campaignId);
    })().catch((handlerError) => {
      logTenantEmailWorkerJobFailed({
        campaignId: job?.data.campaignId ?? "unknown",
        errorMessage: getSesErrorMessage(handlerError),
        recipientId: job?.data.recipientId ?? "unknown",
      });
    });

    logTenantEmailWorkerJobFailed({
      campaignId: job?.data.campaignId ?? "unknown",
      errorMessage: getSesErrorMessage(error),
      recipientId: job?.data.recipientId ?? "unknown",
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
