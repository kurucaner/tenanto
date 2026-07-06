import { createContext, useContext } from "react";

import { type NotificationStreamStatus } from "@/hooks/use-notification-stream";

export interface NotificationStreamContextValue {
  setSuppressToasts: (suppress: boolean) => void;
  status: NotificationStreamStatus;
}

export const NotificationStreamContext = createContext<NotificationStreamContextValue>({
  setSuppressToasts: () => undefined,
  status: "idle",
});

export function useNotificationStreamContext(): NotificationStreamContextValue {
  return useContext(NotificationStreamContext);
}

export function useNotificationStreamStatus(): NotificationStreamStatus {
  return useNotificationStreamContext().status;
}
