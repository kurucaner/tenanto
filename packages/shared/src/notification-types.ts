export type UserNotificationType =
  | "property_member_added"
  | "property_member_removed"
  | "support_request_reply";

export type UserNotificationResourceType = "property" | "support_request";

export interface IUserNotification {
  body: string;
  createdAt: string;
  id: string;
  readAt: string | null;
  resourceId: string | null;
  resourceType: UserNotificationResourceType | null;
  title: string;
  type: UserNotificationType;
}

export interface IUserNotificationsListQuery {
  cursor?: string;
  limit?: number;
}

export interface IUserNotificationsListResponse {
  items: IUserNotification[];
  nextCursor: string | null;
}

export interface IUserNotificationsUnreadCountResponse {
  count: number;
}

export interface IUserNotificationsMarkAllReadResponse {
  updated: number;
}
