import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { getApiBaseUrlForClient, refreshAccessTokenForStream } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  type INotificationStreamEvent,
  type IUserNotificationsUnreadCountResponse,
  UserType,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export type NotificationStreamStatus = "connected" | "connecting" | "degraded" | "idle";

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_FAILURES_BEFORE_DEGRADED = 5;
const PROACTIVE_RECONNECT_MS = 12 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withJitter(delayMs: number): number {
  return delayMs * (0.8 + Math.random() * 0.4);
}

function parseStreamEvent(data: string): INotificationStreamEvent | null {
  try {
    return JSON.parse(data) as INotificationStreamEvent;
  } catch {
    return null;
  }
}

class StreamFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamFatalError";
  }
}

class StreamReconnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamReconnectError";
  }
}

export function useNotificationStream(): NotificationStreamStatus {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userType = useAuthStore((s) => s.user?.userType);
  const [status, setStatus] = useState<NotificationStreamStatus>("idle");
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const enabled = userType === UserType.USER && accessToken != null;

  useEffect(() => {
    const requestReconnect = (): void => {
      setReconnectNonce((value) => value + 1);
    };

    const handleOnline = (): void => {
      requestReconnect();
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === "visible") {
        requestReconnect();
      }
    };

    const handleOffline = (): void => {
      setStatus("degraded");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!enabled || accessToken == null) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let backoffMs = BASE_BACKOFF_MS;
    let consecutiveFailures = 0;
    const abortController = new AbortController();
    let proactiveReconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearProactiveReconnect = (): void => {
      if (proactiveReconnectTimer != null) {
        clearTimeout(proactiveReconnectTimer);
        proactiveReconnectTimer = null;
      }
    };

    const scheduleProactiveReconnect = (): void => {
      clearProactiveReconnect();
      proactiveReconnectTimer = setTimeout(() => {
        abortController.abort();
      }, PROACTIVE_RECONNECT_MS);
    };

    const applyUnreadCount = (count: unknown): void => {
      if (typeof count !== "number") return;
      queryClient.setQueryData<IUserNotificationsUnreadCountResponse>(
        adminQueryKeys.notificationsUnreadCount(),
        { count }
      );
    };

    const handleEvent = (event: INotificationStreamEvent): void => {
      if (event.type === "ping") return;

      if (event.type === "connected" || event.type === "notifications.unread_count") {
        consecutiveFailures = 0;
        backoffMs = BASE_BACKOFF_MS;
        setStatus("connected");
        applyUnreadCount(event.data.count);
      }

      if (event.type === "notifications.inbox_updated") {
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.notificationsList() });
      }
    };

    const connectOnce = async (token: string): Promise<void> => {
      await fetchEventSource(`${getApiBaseUrlForClient()}/notifications/stream`, {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        method: "GET",
        onclose: () => {
          if (!cancelled) {
            throw new StreamReconnectError("Stream closed");
          }
        },
        onerror: (err) => {
          if (err instanceof StreamFatalError || err instanceof StreamReconnectError) {
            throw err;
          }
          throw err instanceof Error ? err : new Error("Stream error");
        },
        onmessage: (message) => {
          if (message.data === "") return;
          const parsed = parseStreamEvent(message.data);
          if (parsed != null) {
            handleEvent(parsed);
          }
        },
        async onopen(response) {
          if (response.status === 401) {
            const newToken = await refreshAccessTokenForStream();
            if (newToken == null) {
              throw new StreamFatalError("Session expired");
            }
            throw new StreamReconnectError("Token refreshed");
          }
          if (response.status === 429) {
            throw new StreamFatalError("Too many stream connections");
          }
          if (!response.ok) {
            throw new Error(`Stream failed: ${response.status}`);
          }
          const contentType = response.headers.get("content-type") ?? "";
          if (!contentType.includes("text/event-stream")) {
            throw new Error("Unexpected stream content type");
          }
          scheduleProactiveReconnect();
        },
        openWhenHidden: true,
        signal: abortController.signal,
      });
    };

    const run = async (): Promise<void> => {
      setStatus((current) => (current === "connected" ? current : "connecting"));

      let token = accessToken;

      while (!cancelled) {
        try {
          await connectOnce(token);
          if (cancelled) break;
        } catch (err) {
          if (cancelled || abortController.signal.aborted) {
            if (!cancelled) {
              token = useAuthStore.getState().accessToken ?? token;
              const refreshed = await refreshAccessTokenForStream();
              if (refreshed != null) {
                token = refreshed;
              }
              consecutiveFailures = 0;
              backoffMs = BASE_BACKOFF_MS;
              setStatus("connecting");
              continue;
            }
            break;
          }

          if (err instanceof StreamFatalError) {
            setStatus("degraded");
            break;
          }

          if (err instanceof StreamReconnectError) {
            token = useAuthStore.getState().accessToken ?? token;
            consecutiveFailures = 0;
            backoffMs = BASE_BACKOFF_MS;
            setStatus("connecting");
            continue;
          }

          consecutiveFailures++;
          if (consecutiveFailures >= MAX_FAILURES_BEFORE_DEGRADED) {
            setStatus("degraded");
          } else {
            setStatus("connecting");
          }

          const delay = withJitter(Math.min(backoffMs, MAX_BACKOFF_MS));
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
          await sleep(delay);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      clearProactiveReconnect();
      abortController.abort();
    };
  }, [accessToken, enabled, queryClient, reconnectNonce]);

  return status;
}
