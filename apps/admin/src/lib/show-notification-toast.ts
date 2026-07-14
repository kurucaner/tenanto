import { toast } from "sonner";

import { router } from "@/app/router";
import { getNotificationHref } from "@/lib/notification-routing";
import { type IUserNotification } from "@/packages/shared";

function showCampaignCompletedNotificationToast(notification: IUserNotification): void {
  const toastId =
    notification.contextResourceId != null
      ? `campaign-completed-${notification.contextResourceId}`
      : notification.id;
  const action = {
    label: "View details",
    onClick: () => {
      router.navigate(getNotificationHref(notification));
    },
  };

  if (notification.title === "Delivered with exceptions") {
    toast.warning(notification.title, {
      action,
      description: notification.body,
      id: toastId,
    });
    return;
  }

  toast.success(notification.title, {
    action,
    description: notification.body,
    id: toastId,
  });
}

export function showNotificationToast(notification: IUserNotification): void {
  if (notification.type === "tenant_email_campaign_completed") {
    showCampaignCompletedNotificationToast(notification);
    return;
  }

  toast.info(notification.title, {
    action: {
      label: "View",
      onClick: () => {
        router.navigate(getNotificationHref(notification));
      },
    },
    description: notification.body,
    id: notification.id,
  });
}
