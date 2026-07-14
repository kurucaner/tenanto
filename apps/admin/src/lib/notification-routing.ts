import { type IUserNotification } from "@/packages/shared";

export function getNotificationHref(notification: IUserNotification): string {
  if (
    notification.type === "tenant_email_campaign_completed" &&
    notification.resourceType === "property" &&
    notification.resourceId != null &&
    notification.contextResourceId != null
  ) {
    return `/properties/${encodeURIComponent(notification.resourceId)}/communications?campaignId=${encodeURIComponent(notification.contextResourceId)}`;
  }
  if (
    notification.type === "export_ready" &&
    notification.resourceType === "property" &&
    notification.resourceId != null
  ) {
    return `/properties/${encodeURIComponent(notification.resourceId)}/exports`;
  }
  if (notification.resourceType === "property" && notification.resourceId != null) {
    return `/properties/${encodeURIComponent(notification.resourceId)}`;
  }
  if (notification.resourceType === "support_request" && notification.resourceId != null) {
    return `/support-requests/${encodeURIComponent(notification.resourceId)}`;
  }
  return "/support-requests";
}
