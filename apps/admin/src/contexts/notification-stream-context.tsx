import { createContext, useContext } from "react";

import { type NotificationStreamStatus } from "@/hooks/use-notification-stream";

export const NotificationStreamContext = createContext<NotificationStreamStatus>("idle");

export function useNotificationStreamStatus(): NotificationStreamStatus {
  return useContext(NotificationStreamContext);
}
