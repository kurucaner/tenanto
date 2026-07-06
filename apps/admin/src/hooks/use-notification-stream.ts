import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { getApiBaseUrlForClient, refreshAccessTokenForStream } from "@/lib/api-client";
import { handleSupportRequestUpdated } from "@/lib/notification-stream-handlers";
import { adminQueryKeys } from "@/lib/query-keys";
import { showNotificationToast } from "@/lib/show-notification-toast";
import {
  type INotificationStreamEvent,
  type IUserNotification,
  type IUserNotificationsUnreadCountResponse,
  UserType,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export type NotificationStreamStatus = "connected" | "connecting" | "degraded" | "idle";

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_FAILURES_BEFORE_DEGRADED = 5;
const PROACTIVE_RECONNECT_MS = 12 * 60 * 1000;
const RECONNECT_DEBOUNCE_MS = 500;
const STREAM_CLIENT_ID_KEY = "notification-stream-client-id";

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

function parseStreamNotification(value: unknown): IUserNotification | null {
  if (value == null || typeof value !== "object") return null;
  const notification = value as Record<string, unknown>;
  if (
    typeof notification.id === "string" &&
    typeof notification.title === "string" &&
    typeof notification.body === "string"
  ) {
    return notification as unknown as IUserNotification;
  }
  return null;
}

function getStreamClientId(): string {
  const existing = sessionStorage.getItem(STREAM_CLIENT_ID_KEY);
  if (existing != null && existing !== "") {
    return existing;
  }
  const id = crypto.randomUUID();
  sessionStorage.setItem(STREAM_CLIENT_ID_KEY, id);
  return id;
}

class StreamFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamFatalError";
  }
}

class StreamReconnectError extends Error {
  readonly retryDelayMs?: number;

  constructor(message: string, retryDelayMs?: number) {
    super(message);
    this.name = "StreamReconnectError";
    this.retryDelayMs = retryDelayMs;
  }
}

export interface UseNotificationStreamOptions {
  suppressToasts?: boolean;
}

export function useNotificationStream(
  options: UseNotificationStreamOptions = {}
): NotificationStreamStatus {
  const { suppressToasts = false } = options;
  const queryClient = useQueryClient();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userType = useAuthStore((s) => s.user?.userType);
  const [status, setStatus] = useState<NotificationStreamStatus>("idle");
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const statusRef = useRef(status);
  const pathnameRef = useRef(location.pathname);
  const streamClientIdRef = useRef(getStreamClientId());
  const reconnectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressToastsRef = useRef(suppressToasts);

  const enabled = accessToken != null;

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    suppressToastsRef.current = suppressToasts;
  }, [suppressToasts]);

  useEffect(() => {
    const scheduleReconnect = (): void => {
      if (statusRef.current === "connected") return;

      if (reconnectDebounceRef.current != null) {
        clearTimeout(reconnectDebounceRef.current);
      }

      reconnectDebounceRef.current = setTimeout(() => {
        reconnectDebounceRef.current = null;
        if (statusRef.current === "connected") return;
        setReconnectNonce((value) => value + 1);
      }, RECONNECT_DEBOUNCE_MS);
    };

    const handleOnline = (): void => {
      scheduleReconnect();
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === "visible") {
        scheduleReconnect();
      }
    };

    const handleOffline = (): void => {
      setStatus("degraded");
    };

    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (reconnectDebounceRef.current != null) {
        clearTimeout(reconnectDebounceRef.current);
      }
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!enabled || accessToken == null) {
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
        if (userType === UserType.USER) {
          applyUnreadCount(event.data.count);
        }
      }

      if (event.type === "notifications.inbox_updated") {
        if (userType === UserType.USER) {
          queryClient.invalidateQueries({ queryKey: adminQueryKeys.notificationsList() });
        }
      }

      if (event.type === "notifications.new") {
        if (userType === UserType.USER && !suppressToastsRef.current) {
          const notification = parseStreamNotification(event.data.notification);
          if (notification != null) {
            showNotificationToast(notification);
          }
        }
      }

      if (event.type === "support_request.updated") {
        const supportRequestId = event.data.supportRequestId;
        if (typeof supportRequestId === "string") {
          handleSupportRequestUpdated(queryClient, supportRequestId, pathnameRef.current);
        }
      }
    };

    const connectOnce = async (token: string): Promise<void> => {
      await fetchEventSource(`${getApiBaseUrlForClient()}/notifications/stream`, {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
          "X-Stream-Client-Id": streamClientIdRef.current,
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
            throw new StreamReconnectError("Too many stream connections", BASE_BACKOFF_MS);
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
              await sleep(withJitter(BASE_BACKOFF_MS));
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
            if (err.retryDelayMs != null) {
              await sleep(withJitter(err.retryDelayMs));
            }
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
  }, [accessToken, enabled, queryClient, reconnectNonce, userType]);

  return enabled && accessToken != null ? status : "idle";
}
