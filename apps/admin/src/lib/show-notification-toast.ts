import { toast } from "sonner";

import { router } from "@/app/router";
import { getNotificationHref } from "@/lib/notification-routing";
import { type IUserNotification } from "@/packages/shared";

export function showNotificationToast(notification: IUserNotification): void {
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
