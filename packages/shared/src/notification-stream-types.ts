import { type IUserNotification } from "./notification-types";
import {
  type TExportFormat,
  type TExportJobStatus,
  type TExportResourceType,
} from "./property-export-types";
import { type TSupportStagedUploadStatus } from "./support-types";
import { type TTenantEmailCampaignStatus } from "./tenant-email-campaign-types";

export type NotificationStreamEventType =
  | "connected"
  | "ping"
  | "notifications.new"
  | "notifications.unread_count"
  | "notifications.inbox_updated"
  | "support_attachment.updated"
  | "export_job.updated"
  | "support_request.updated"
  | "tenant_email_campaign.updated";

export interface INotificationStreamEvent {
  data: Record<string, unknown>;
  type: NotificationStreamEventType;
  v: 1;
}

export interface INotificationStreamUnreadCountData {
  count: number;
}

export interface INotificationStreamConnectedData {
  count: number;
  serverTime: string;
}

export interface INotificationStreamNewData {
  notification: IUserNotification;
}

export interface INotificationStreamSupportRequestUpdatedData {
  supportRequestId: string;
}

export interface INotificationStreamSupportAttachmentUpdatedData {
  status: TSupportStagedUploadStatus;
  storageKey: string;
  supportRequestId?: string;
}

export interface INotificationStreamTenantEmailCampaignUpdatedData {
  campaignId: string;
  failedCount: number;
  propertyId: string;
  sentCount: number;
  skippedCount: number;
  status: TTenantEmailCampaignStatus;
  totalCount: number;
}

export interface INotificationStreamExportJobUpdatedData {
  format: TExportFormat;
  jobId: string;
  propertyId: string;
  resourceType: TExportResourceType;
  rowCount?: number;
  status: TExportJobStatus;
}
