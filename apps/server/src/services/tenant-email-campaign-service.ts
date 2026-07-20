import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyTenantEmailCampaignsDb } from "@/db/property-tenant-email-campaigns";
import {
  getTenantEmailCampaignIdempotencyConflictId,
  tenantEmailCampaignNoRecipientsError,
  tenantEmailCampaignValidationError,
} from "@/errors/tenant-email-campaign-errors";
import {
  TENANT_EMAIL_CAMPAIGN_MAX_BODY_BYTES,
  TENANT_EMAIL_CAMPAIGN_MAX_SUBJECT_LENGTH,
} from "@/lib/tenant-email-campaign-config";
import { getTenantEmailCampaignMaxRecipients } from "@/lib/tenant-email-campaign-limits";
import {
  type ICreateTenantEmailCampaignBody,
  type ITenantEmailCampaign,
  type ITenantEmailCampaignCreateResponse,
  type ITenantEmailCampaignPreviewResponse,
  type ITenantEmailRecipientResolution,
  PropertyLongStayStatus,
  resolveTenantEmailRecipients,
} from "@/packages/shared";
import { enqueueTenantEmailSendJobs } from "@/queues/tenant-email-queue";
import { loadSecondaryTenantContactsByLeaseIds } from "@/services/load-secondary-tenant-contacts-by-lease-ids";
import { logTenantEmailCampaignCreated } from "@/services/tenant-email-campaign-observability";
import { reenqueueQueuedRecipientsForCampaign } from "@/services/tenant-email-campaign-reenqueue";
import { maybePublishTenantEmailCampaignUpdated } from "@/services/tenant-email-campaign-stream";
import { sanitizeTenantEmailHtml, tenantEmailHtmlToPlainText } from "@/ses/tenant-email-html";

function validateCampaignBody(body: ICreateTenantEmailCampaignBody): {
  htmlBody: string;
  subject: string;
  textBody: string;
} {
  const subject = body.subject.trim();
  if (subject.length === 0) {
    throw tenantEmailCampaignValidationError("Subject is required");
  }
  if (subject.length > TENANT_EMAIL_CAMPAIGN_MAX_SUBJECT_LENGTH) {
    throw tenantEmailCampaignValidationError("Subject is too long");
  }

  const rawHtml = body.htmlBody.trim();
  if (rawHtml.length === 0) {
    throw tenantEmailCampaignValidationError("Email body is required");
  }
  if (Buffer.byteLength(rawHtml, "utf8") > TENANT_EMAIL_CAMPAIGN_MAX_BODY_BYTES) {
    throw tenantEmailCampaignValidationError("Email body is too large");
  }

  const htmlBody = sanitizeTenantEmailHtml(rawHtml);
  if (htmlBody.length === 0) {
    throw tenantEmailCampaignValidationError("Email body is empty after sanitization");
  }

  const textBody = tenantEmailHtmlToPlainText(htmlBody);
  if (textBody.length === 0) {
    throw tenantEmailCampaignValidationError("Email body must contain readable text");
  }

  return { htmlBody, subject, textBody };
}

async function resolveCampaignRecipientsForProperty(
  propertyId: string
): Promise<ITenantEmailRecipientResolution> {
  const leases = await propertyLongStaysDb.listByProperty(propertyId, {
    status: PropertyLongStayStatus.ACTIVE,
  });
  const secondaryContactsByLeaseId = await loadSecondaryTenantContactsByLeaseIds(
    leases.map((lease) => lease.id)
  );
  return resolveTenantEmailRecipients(leases, secondaryContactsByLeaseId);
}

export async function buildTenantEmailCampaignPreview(
  propertyId: string
): Promise<ITenantEmailCampaignPreviewResponse> {
  const resolution = await resolveCampaignRecipientsForProperty(propertyId);

  return {
    recipientCount: resolution.recipients.length,
    recipients: resolution.recipients,
    skipped: resolution.skipped,
    skippedCount: resolution.skipped.length,
  };
}

export async function createTenantEmailCampaign(params: {
  body: ICreateTenantEmailCampaignBody;
  createdBy: string;
  idempotencyKey: string;
  propertyId: string;
}): Promise<ITenantEmailCampaignCreateResponse> {
  const { htmlBody, subject, textBody } = validateCampaignBody(params.body);

  const resolution = await resolveCampaignRecipientsForProperty(params.propertyId);

  if (resolution.recipients.length === 0) {
    throw tenantEmailCampaignNoRecipientsError();
  }

  if (resolution.recipients.length > getTenantEmailCampaignMaxRecipients()) {
    throw tenantEmailCampaignValidationError(
      `Campaign exceeds max recipient limit (${getTenantEmailCampaignMaxRecipients()})`
    );
  }

  try {
    const { campaign, queuedRecipientIds } =
      await propertyTenantEmailCampaignsDb.createCampaignWithRecipients({
        createdBy: params.createdBy,
        htmlBody,
        idempotencyKey: params.idempotencyKey,
        propertyId: params.propertyId,
        recipients: resolution.recipients,
        skipped: resolution.skipped,
        subject,
        textBody,
      });

    if (queuedRecipientIds.length > 0) {
      await enqueueTenantEmailSendJobs(campaign.id, queuedRecipientIds);
    } else {
      const transitionedToTerminal = await propertyTenantEmailCampaignsDb.refreshCampaignCompletion(
        campaign.id
      );
      await maybePublishTenantEmailCampaignUpdated(campaign.id, { transitionedToTerminal });
    }

    const refreshed = (await propertyTenantEmailCampaignsDb.findById(campaign.id)) ?? campaign;

    logTenantEmailCampaignCreated({
      createdBy: refreshed.createdBy,
      id: refreshed.id,
      propertyId: refreshed.propertyId,
      recipientCount: refreshed.recipientCount,
      skippedCount: refreshed.skippedCount,
    });

    return {
      campaignId: refreshed.id,
      recipientCount: refreshed.recipientCount,
      skippedCount: refreshed.skippedCount,
      status: refreshed.status,
    };
  } catch (error) {
    const existingCampaignId = getTenantEmailCampaignIdempotencyConflictId(error);
    if (existingCampaignId != null) {
      const existing = await propertyTenantEmailCampaignsDb.findById(existingCampaignId);
      if (!existing) {
        throw error;
      }
      return finalizeExistingCampaignResponse(existing);
    }
    throw error;
  }
}

function toCreateResponse(campaign: ITenantEmailCampaign): ITenantEmailCampaignCreateResponse {
  return {
    campaignId: campaign.id,
    recipientCount: campaign.recipientCount,
    skippedCount: campaign.skippedCount,
    status: campaign.status,
  };
}

async function finalizeExistingCampaignResponse(
  campaign: ITenantEmailCampaign
): Promise<ITenantEmailCampaignCreateResponse> {
  await reenqueueQueuedRecipientsForCampaign(campaign.id);
  const refreshed = (await propertyTenantEmailCampaignsDb.findById(campaign.id)) ?? campaign;
  return toCreateResponse(refreshed);
}

export async function getExistingTenantEmailCampaignByIdempotencyKey(
  propertyId: string,
  idempotencyKey: string
): Promise<ITenantEmailCampaignCreateResponse | null> {
  const existing = await propertyTenantEmailCampaignsDb.findByIdempotencyKey(
    propertyId,
    idempotencyKey
  );
  return existing ? toCreateResponse(existing) : null;
}
