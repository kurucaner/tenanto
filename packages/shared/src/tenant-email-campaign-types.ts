export type TTenantEmailCampaignStatus =
  "queued" | "sending" | "completed" | "completed_with_errors" | "failed";

export const TenantEmailCampaignStatus = {
  COMPLETED: "completed",
  COMPLETED_WITH_ERRORS: "completed_with_errors",
  FAILED: "failed",
  QUEUED: "queued",
  SENDING: "sending",
} as const satisfies Record<string, TTenantEmailCampaignStatus>;

export type TTenantEmailRecipientStatus = "queued" | "sent" | "failed" | "skipped";

export const TenantEmailRecipientStatus = {
  FAILED: "failed",
  QUEUED: "queued",
  SENT: "sent",
  SKIPPED: "skipped",
} as const satisfies Record<string, TTenantEmailRecipientStatus>;

export type TTenantEmailTenantRole = "primary" | "secondary";

export const TenantEmailTenantRole = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
} as const satisfies Record<string, TTenantEmailTenantRole>;

export interface ICreateTenantEmailCampaignBody {
  htmlBody: string;
  subject: string;
}

export interface ITenantEmailCampaign {
  completedAt: string | null;
  createdAt: string;
  createdBy: string;
  failedCount: number;
  htmlBody: string;
  id: string;
  idempotencyKey: string;
  propertyId: string;
  recipientCount: number;
  sentCount: number;
  skippedCount: number;
  status: TTenantEmailCampaignStatus;
  subject: string;
  textBody: string;
  updatedAt: string;
}

export interface ITenantEmailCampaignRecipient {
  attempts: number;
  campaignId: string;
  email: string;
  id: string;
  lastError: string | null;
  leaseId: string;
  sentAt: string | null;
  status: TTenantEmailRecipientStatus;
  tenantName: string;
  tenantRole: TTenantEmailTenantRole;
}

export interface ITenantEmailCampaignCreateResponse {
  campaignId: string;
  recipientCount: number;
  skippedCount: number;
  status: TTenantEmailCampaignStatus;
}

export interface ITenantEmailCampaignPreviewResponse {
  recipientCount: number;
  recipients: ITenantEmailCampaignPreviewRecipient[];
  skipped: ITenantEmailCampaignPreviewSkipped[];
  skippedCount: number;
}

export interface ITenantEmailCampaignPreviewRecipient {
  email: string;
  leaseId: string;
  tenantName: string;
  tenantRole: TTenantEmailTenantRole;
}

export interface ITenantEmailCampaignPreviewSkipped {
  leaseId: string;
  reason: string;
  tenantName: string;
  tenantRole: TTenantEmailTenantRole;
}

export interface ITenantEmailCampaignDetailResponse {
  campaign: ITenantEmailCampaign;
  recipients: ITenantEmailCampaignRecipient[];
}

export interface ITenantEmailCampaignListResponse {
  campaigns: ITenantEmailCampaign[];
}

export interface ITenantEmailCampaignReenqueueResponse {
  campaignId: string;
  enqueuedCount: number;
  status: TTenantEmailCampaignStatus;
}

export interface ITenantEmailResolvedRecipient {
  email: string;
  leaseId: string;
  tenantName: string;
  tenantRole: TTenantEmailTenantRole;
}

export interface ITenantEmailSkippedRecipient {
  leaseId: string;
  reason: string;
  tenantName: string;
  tenantRole: TTenantEmailTenantRole;
}

export interface ITenantEmailRecipientResolution {
  recipients: ITenantEmailResolvedRecipient[];
  skipped: ITenantEmailSkippedRecipient[];
}
