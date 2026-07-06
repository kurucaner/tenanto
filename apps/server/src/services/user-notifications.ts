import { userNotificationsDb } from "@/db/user-notifications";
import { userDb } from "@/db/users";
import {
  type TAdminSupportRequestSettableStatus,
  type UserNotificationResourceType,
  type UserNotificationType,
  UserType,
} from "@/packages/shared";
import { notificationStreamHub } from "@/services/notification-stream-hub";

export interface NotifyUserInput {
  body: string;
  resourceId?: string;
  resourceType?: UserNotificationResourceType;
  title: string;
  type: UserNotificationType;
  userId: string;
}

export async function notifyUser(input: NotifyUserInput): Promise<void> {
  const user = await userDb.findById(input.userId);
  if (user == null || user.userType !== UserType.USER) {
    return;
  }

  await userNotificationsDb.create(input);
  notificationStreamHub.publish(input.userId).catch((err) => {
    console.error("[notifyUser] Failed to publish notification stream update:", err);
  });
}

export function truncateNotificationBody(text: string, maxLength = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function buildSupportStatusChangedNotification(
  nextStatus: TAdminSupportRequestSettableStatus
): { body: string; title: string } {
  if (nextStatus === "in_progress") {
    return {
      body: "We're looking into your support request.",
      title: "Support request in progress",
    };
  }
  return {
    body: "Your support request has been marked resolved.",
    title: "Support request resolved",
  };
}
