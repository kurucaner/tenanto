import { type IUserNotification } from "@/packages/shared";

export function getNotificationHref(notification: IUserNotification): string {
  if (notification.resourceType === "property" && notification.resourceId != null) {
    return `/properties/${encodeURIComponent(notification.resourceId)}`;
  }
  if (notification.resourceType === "support_request" && notification.resourceId != null) {
    return `/support-requests/${encodeURIComponent(notification.resourceId)}`;
  }
  return "/support-requests";
}
