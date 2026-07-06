import { userNotificationsDb } from "@/db/user-notifications";
import { userDb } from "@/db/users";
import {
  type UserNotificationResourceType,
  type UserNotificationType,
  UserType,
} from "@/packages/shared";

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
}

export function truncateNotificationBody(text: string, maxLength = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}
