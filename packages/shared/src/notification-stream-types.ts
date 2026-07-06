export type NotificationStreamEventType =
  | "connected"
  | "ping"
  | "notifications.unread_count"
  | "notifications.inbox_updated"
  | "support_request.updated";

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

export interface INotificationStreamSupportRequestUpdatedData {
  supportRequestId: string;
}
