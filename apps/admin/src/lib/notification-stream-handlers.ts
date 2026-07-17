import { type QueryClient } from "@tanstack/react-query";

import { propertyExportsApi, supportApi, tenantEmailCampaignsApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { showPropertyExportCompletedToast } from "@/lib/show-property-export-queued-toast";
import { notifySupportAttachmentStatus } from "@/lib/support-attachment-status-registry";
import { shouldSkipSupportDetailRefresh } from "@/lib/support-chat-cache";
import { isTenantEmailCampaignTerminal } from "@/lib/tenant-email-campaign-utils";
import {
  ExportFormat,
  ExportJobStatus,
  ExportResourceType,
  type INotificationStreamExportJobUpdatedData,
  type INotificationStreamSupportAttachmentUpdatedData,
  type INotificationStreamTenantEmailCampaignUpdatedData,
  type IPropertyExportDetailResponse,
  type ITenantEmailCampaignDetailResponse,
  type IUserNotification,
  TenantEmailCampaignStatus,
  type TExportFormat,
  type TExportJobStatus,
  type TExportResourceType,
  type TSupportStagedUploadStatus,
  type TTenantEmailCampaignStatus,
  UserType,
} from "@/packages/shared";

function isPropertyMembershipNotification(
  type: string
): type is "property_member_added" | "property_member_removed" {
  return type === "property_member_added" || type === "property_member_removed";
}

export function handlePropertyMembershipNotification(
  queryClient: QueryClient,
  notification: IUserNotification
): void {
  if (!isPropertyMembershipNotification(notification.type)) {
    return;
  }

  queryClient.invalidateQueries({ queryKey: ["properties"] });

  if (notification.resourceId != null) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.propertyDetail(notification.resourceId),
    });
  }
}

function isSupportStagedUploadStatus(value: unknown): value is TSupportStagedUploadStatus {
  return value === "pending" || value === "confirmed" || value === "linked";
}

export function parseSupportAttachmentUpdatedData(
  data: Record<string, unknown>
): INotificationStreamSupportAttachmentUpdatedData | null {
  const storageKey = data.storageKey;
  const status = data.status;
  if (typeof storageKey !== "string" || !isSupportStagedUploadStatus(status)) {
    return null;
  }

  const supportRequestId = data.supportRequestId;
  return {
    status,
    storageKey,
    ...(typeof supportRequestId === "string" ? { supportRequestId } : {}),
  };
}

export function handlePropertyMemberInviteReceivedNotification(
  queryClient: QueryClient,
  notification: IUserNotification
): void {
  if (notification.type !== "property_member_invite_received") {
    return;
  }

  queryClient.invalidateQueries({ queryKey: queryKeys.pendingMemberInvites() });

  if (notification.resourceId != null) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.propertyDetail(notification.resourceId),
    });
  }
}

export function handleSupportRequestUpdated(
  queryClient: QueryClient,
  supportRequestId: string,
  pathname: string,
  userType: UserType
): void {
  if (document.visibilityState !== "visible") return;

  if (userType === UserType.ADMIN) {
    queryClient.invalidateQueries({ queryKey: ["support-requests"] });
  } else {
    queryClient.invalidateQueries({ queryKey: ["support", "list"] });
  }

  if (pathname !== `/support-requests/${supportRequestId}`) return;
  if (shouldSkipSupportDetailRefresh(supportRequestId)) return;

  queryClient.fetchQuery({
    queryFn: () => supportApi.get(supportRequestId),
    queryKey: queryKeys.supportRequest(supportRequestId),
    staleTime: 0,
  });
}

function isTenantEmailCampaignStatus(value: unknown): value is TTenantEmailCampaignStatus {
  return (
    value === TenantEmailCampaignStatus.COMPLETED ||
    value === TenantEmailCampaignStatus.COMPLETED_WITH_ERRORS ||
    value === TenantEmailCampaignStatus.FAILED ||
    value === TenantEmailCampaignStatus.QUEUED ||
    value === TenantEmailCampaignStatus.SENDING
  );
}

export function parseTenantEmailCampaignUpdatedData(
  data: Record<string, unknown>
): INotificationStreamTenantEmailCampaignUpdatedData | null {
  const campaignId = data.campaignId;
  const propertyId = data.propertyId;
  const status = data.status;
  const sentCount = data.sentCount;
  const failedCount = data.failedCount;
  const skippedCount = data.skippedCount;
  const totalCount = data.totalCount;

  if (
    typeof campaignId !== "string" ||
    typeof propertyId !== "string" ||
    !isTenantEmailCampaignStatus(status) ||
    typeof sentCount !== "number" ||
    typeof failedCount !== "number" ||
    typeof skippedCount !== "number" ||
    typeof totalCount !== "number"
  ) {
    return null;
  }

  return {
    campaignId,
    failedCount,
    propertyId,
    sentCount,
    skippedCount,
    status,
    totalCount,
  };
}

function patchTenantEmailCampaignDetail(
  existing: ITenantEmailCampaignDetailResponse,
  update: INotificationStreamTenantEmailCampaignUpdatedData
): ITenantEmailCampaignDetailResponse {
  return {
    ...existing,
    campaign: {
      ...existing.campaign,
      failedCount: update.failedCount,
      recipientCount: update.totalCount,
      sentCount: update.sentCount,
      skippedCount: update.skippedCount,
      status: update.status,
    },
  };
}

export function handleTenantEmailCampaignUpdated(
  queryClient: QueryClient,
  data: INotificationStreamTenantEmailCampaignUpdatedData,
  pathname: string
): void {
  queryClient.setQueryData<ITenantEmailCampaignDetailResponse>(
    queryKeys.propertyTenantEmailCampaign(data.propertyId, data.campaignId),
    (existing) => (existing == null ? existing : patchTenantEmailCampaignDetail(existing, data))
  );

  queryClient.invalidateQueries({
    queryKey: queryKeys.propertyTenantEmailCampaigns(data.propertyId),
  });

  if (isTenantEmailCampaignTerminal(data.status)) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.propertyTenantEmailCampaign(data.propertyId, data.campaignId),
    });
  }

  const communicationsPath = `/properties/${data.propertyId}/communications`;
  const isOnCommunicationsTab = pathname === communicationsPath;

  const shouldRefetchDetailOnCommunicationsTab =
    isOnCommunicationsTab &&
    document.visibilityState === "visible" &&
    !isTenantEmailCampaignTerminal(data.status);

  if (shouldRefetchDetailOnCommunicationsTab) {
    queryClient.fetchQuery({
      queryFn: () => tenantEmailCampaignsApi.get(data.propertyId, data.campaignId),
      queryKey: queryKeys.propertyTenantEmailCampaign(data.propertyId, data.campaignId),
      staleTime: 0,
    });
  }
}

function isExportJobStatus(value: unknown): value is TExportJobStatus {
  return (
    value === ExportJobStatus.COMPLETED ||
    value === ExportJobStatus.EXPIRED ||
    value === ExportJobStatus.FAILED ||
    value === ExportJobStatus.PENDING ||
    value === ExportJobStatus.PROCESSING
  );
}

function isExportFormat(value: unknown): value is TExportFormat {
  return value === ExportFormat.CSV || value === ExportFormat.XLSX;
}

function isExportResourceType(value: unknown): value is TExportResourceType {
  return (
    value === ExportResourceType.EXPENSES ||
    value === ExportResourceType.INCOME ||
    value === ExportResourceType.LEASES
  );
}

export function parseExportJobUpdatedData(
  data: Record<string, unknown>
): INotificationStreamExportJobUpdatedData | null {
  const jobId = data.jobId;
  const propertyId = data.propertyId;
  const status = data.status;
  const format = data.format;
  const resourceType = data.resourceType;
  const rowCount = data.rowCount;

  if (
    typeof jobId !== "string" ||
    typeof propertyId !== "string" ||
    !isExportJobStatus(status) ||
    !isExportFormat(format) ||
    !isExportResourceType(resourceType)
  ) {
    return null;
  }

  return {
    format,
    jobId,
    propertyId,
    resourceType,
    status,
    ...(typeof rowCount === "number" ? { rowCount } : {}),
  };
}

function patchExportJobDetail(
  existing: IPropertyExportDetailResponse,
  update: INotificationStreamExportJobUpdatedData
): IPropertyExportDetailResponse {
  return {
    job: {
      ...existing.job,
      rowCount: update.rowCount ?? existing.job.rowCount,
      status: update.status,
    },
  };
}

export function handleExportJobUpdated(
  queryClient: QueryClient,
  data: INotificationStreamExportJobUpdatedData,
  pathname: string
): void {
  queryClient.setQueryData<IPropertyExportDetailResponse>(
    queryKeys.propertyExport(data.propertyId, data.jobId),
    (existing) => (existing == null ? existing : patchExportJobDetail(existing, data))
  );

  queryClient.invalidateQueries({
    queryKey: queryKeys.propertyExportsPrefix(data.propertyId),
  });

  const exportsPath = `/properties/${data.propertyId}/exports`;
  const isOnExportsTab = pathname === exportsPath;

  if (
    data.status === ExportJobStatus.COMPLETED &&
    !isOnExportsTab &&
    document.visibilityState === "visible"
  ) {
    showPropertyExportCompletedToast(data.propertyId, data.jobId);
  }

  if (!isOnExportsTab || document.visibilityState !== "visible") {
    return;
  }

  queryClient.fetchQuery({
    queryFn: () => propertyExportsApi.get(data.propertyId, data.jobId),
    queryKey: queryKeys.propertyExport(data.propertyId, data.jobId),
    staleTime: 0,
  });
}

export function handleSupportAttachmentUpdated(
  queryClient: QueryClient,
  data: INotificationStreamSupportAttachmentUpdatedData,
  pathname: string,
  userType: UserType
): void {
  notifySupportAttachmentStatus(data.storageKey, data.status);

  if (
    data.status === "linked" &&
    data.supportRequestId != null &&
    document.visibilityState === "visible"
  ) {
    handleSupportRequestUpdated(queryClient, data.supportRequestId, pathname, userType);
  }
}
