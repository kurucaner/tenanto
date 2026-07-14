import { fetchEventSource } from "@microsoft/fetch-event-source";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { getApiBaseUrlForClient, refreshAccessTokenForStream } from "@/lib/api-client";
import { NOTIFICATION_STREAM_CLIENT_ID_KEY } from "@/lib/notification-stream-constants";
import {
  handleExportJobUpdated,
  handlePropertyMembershipNotification,
  handleSupportAttachmentUpdated,
  handleSupportRequestUpdated,
  handleTenantEmailCampaignUpdated,
  parseExportJobUpdatedData,
  parseSupportAttachmentUpdatedData,
  parseTenantEmailCampaignUpdatedData,
} from "@/lib/notification-stream-handlers";
import { queryKeys } from "@/lib/query-keys";
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
const STREAM_CLIENT_ID_KEY = NOTIFICATION_STREAM_CLIENT_ID_KEY;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function randomUnitInterval(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0]! / 0xffffffff;
}

function withJitter(delayMs: number): number {
  return delayMs * (0.8 + randomUnitInterval() * 0.4);
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

interface IStreamReconnectRefs {
  reconnectDebounceRef: { current: ReturnType<typeof setTimeout> | null };
  statusRef: { current: NotificationStreamStatus };
}

function clearStreamReconnectDebounce(
  reconnectDebounceRef: IStreamReconnectRefs["reconnectDebounceRef"]
): void {
  if (reconnectDebounceRef.current != null) {
    clearTimeout(reconnectDebounceRef.current);
    reconnectDebounceRef.current = null;
  }
}

function flushStreamReconnect(
  statusRef: IStreamReconnectRefs["statusRef"],
  setReconnectNonce: Dispatch<SetStateAction<number>>
): void {
  if (statusRef.current === "connected") return;
  setReconnectNonce((value) => value + 1);
}

function scheduleStreamReconnect(
  refs: IStreamReconnectRefs,
  setReconnectNonce: Dispatch<SetStateAction<number>>
): void {
  if (refs.statusRef.current === "connected") return;

  clearStreamReconnectDebounce(refs.reconnectDebounceRef);
  refs.reconnectDebounceRef.current = setTimeout(() => {
    refs.reconnectDebounceRef.current = null;
    flushStreamReconnect(refs.statusRef, setReconnectNonce);
  }, RECONNECT_DEBOUNCE_MS);
}

function applyStreamUnreadCount(queryClient: QueryClient, count: unknown): void {
  if (typeof count !== "number") return;
  queryClient.setQueryData<IUserNotificationsUnreadCountResponse>(
    queryKeys.notificationsUnreadCount(),
    { count }
  );
}

interface INotificationStreamEventContext {
  pathname: string;
  queryClient: QueryClient;
  suppressToasts: boolean;
  userType: UserType | undefined;
}

function handleNotificationStreamEvent(
  event: INotificationStreamEvent,
  context: INotificationStreamEventContext
): void {
  if (event.type === "ping") return;

  if (event.type === "connected" || event.type === "notifications.unread_count") {
    if (context.userType === UserType.USER) {
      applyStreamUnreadCount(context.queryClient, event.data.count);
    }
  }

  if (event.type === "notifications.inbox_updated") {
    if (context.userType === UserType.USER) {
      context.queryClient.invalidateQueries({ queryKey: queryKeys.notificationsList() });
    }
  }

  if (event.type === "notifications.new") {
    const notification = parseStreamNotification(event.data.notification);
    if (notification != null && context.userType === UserType.USER) {
      handlePropertyMembershipNotification(context.queryClient, notification);

      if (!context.suppressToasts) {
        showNotificationToast(notification);
      }
    }
  }

  if (event.type === "support_request.updated") {
    const supportRequestId = event.data.supportRequestId;
    if (typeof supportRequestId === "string" && context.userType != null) {
      handleSupportRequestUpdated(
        context.queryClient,
        supportRequestId,
        context.pathname,
        context.userType
      );
    }
  }

  if (event.type === "support_attachment.updated") {
    const parsed = parseSupportAttachmentUpdatedData(event.data);
    if (parsed != null && context.userType != null) {
      handleSupportAttachmentUpdated(
        context.queryClient,
        parsed,
        context.pathname,
        context.userType
      );
    }
  }

  if (event.type === "tenant_email_campaign.updated") {
    const parsed = parseTenantEmailCampaignUpdatedData(event.data);
    if (parsed != null) {
      handleTenantEmailCampaignUpdated(context.queryClient, parsed, context.pathname);
    }
  }

  if (event.type === "export_job.updated") {
    const parsed = parseExportJobUpdatedData(event.data);
    if (parsed != null) {
      handleExportJobUpdated(context.queryClient, parsed, context.pathname);
    }
  }
}

function handleStreamMessage(
  message: { data: string },
  onEvent: (event: INotificationStreamEvent) => void
): void {
  if (message.data === "") return;
  const parsed = parseStreamEvent(message.data);
  if (parsed != null) {
    onEvent(parsed);
  }
}

function handleStreamClose(cancelled: boolean): void {
  if (!cancelled) {
    throw new StreamReconnectError("Stream closed");
  }
}

function handleStreamTransportError(err: unknown): never {
  if (err instanceof StreamFatalError || err instanceof StreamReconnectError) {
    throw err;
  }
  throw err instanceof Error ? err : new Error("Stream error");
}

async function handleStreamOpen(
  response: Response,
  scheduleProactiveReconnect: () => void
): Promise<void> {
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
}

interface INotificationStreamConnectionParams {
  abortController: AbortController;
  isCancelled: () => boolean;
  onEvent: (event: INotificationStreamEvent) => void;
  scheduleProactiveReconnect: () => void;
  streamClientId: string;
  token: string;
}

async function connectNotificationStreamOnce(
  params: INotificationStreamConnectionParams
): Promise<void> {
  await fetchEventSource(`${getApiBaseUrlForClient()}/notifications/stream`, {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${params.token}`,
      "X-Stream-Client-Id": params.streamClientId,
    },
    method: "GET",
    onclose: () => {
      handleStreamClose(params.isCancelled());
    },
    onerror: handleStreamTransportError,
    onmessage: (message) => {
      handleStreamMessage(message, params.onEvent);
    },
    onopen: (response) => handleStreamOpen(response, params.scheduleProactiveReconnect),
    openWhenHidden: true,
    signal: params.abortController.signal,
  });
}

function createStreamEventDispatcher(
  onEvent: (event: INotificationStreamEvent) => void,
  onConnected: () => void
): (event: INotificationStreamEvent) => void {
  return (event) => {
    if (event.type === "connected" || event.type === "notifications.unread_count") {
      onConnected();
    }
    onEvent(event);
  };
}

interface INotificationStreamRunParams {
  abortController: AbortController;
  accessToken: string;
  isCancelled: () => boolean;
  onEvent: (event: INotificationStreamEvent) => void;
  setStatus: Dispatch<SetStateAction<NotificationStreamStatus>>;
  streamClientId: string;
}

async function runNotificationStream(params: INotificationStreamRunParams): Promise<void> {
  params.setStatus((current) => (current === "connected" ? current : "connecting"));

  let token = params.accessToken;
  let backoffMs = BASE_BACKOFF_MS;
  let consecutiveFailures = 0;
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
      params.abortController.abort();
    }, PROACTIVE_RECONNECT_MS);
  };

  const dispatchEvent = createStreamEventDispatcher(params.onEvent, () => {
    consecutiveFailures = 0;
    backoffMs = BASE_BACKOFF_MS;
    params.setStatus("connected");
  });

  while (!params.isCancelled()) {
    try {
      await connectNotificationStreamOnce({
        abortController: params.abortController,
        isCancelled: params.isCancelled,
        onEvent: dispatchEvent,
        scheduleProactiveReconnect,
        streamClientId: params.streamClientId,
        token,
      });
      if (params.isCancelled()) break;
    } catch (err) {
      if (params.isCancelled() || params.abortController.signal.aborted) {
        if (!params.isCancelled()) {
          await sleep(withJitter(BASE_BACKOFF_MS));
          token = useAuthStore.getState().accessToken ?? token;
          const refreshed = await refreshAccessTokenForStream();
          if (refreshed != null) {
            token = refreshed;
          }
          consecutiveFailures = 0;
          backoffMs = BASE_BACKOFF_MS;
          params.setStatus("connecting");
          continue;
        }
        break;
      }

      if (err instanceof StreamFatalError) {
        params.setStatus("degraded");
        break;
      }

      if (err instanceof StreamReconnectError) {
        token = useAuthStore.getState().accessToken ?? token;
        consecutiveFailures = 0;
        backoffMs = BASE_BACKOFF_MS;
        params.setStatus("connecting");
        if (err.retryDelayMs != null) {
          await sleep(withJitter(err.retryDelayMs));
        }
        continue;
      }

      consecutiveFailures++;
      if (consecutiveFailures >= MAX_FAILURES_BEFORE_DEGRADED) {
        params.setStatus("degraded");
      } else {
        params.setStatus("connecting");
      }

      const delay = withJitter(Math.min(backoffMs, MAX_BACKOFF_MS));
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      await sleep(delay);
    }
  }

  clearProactiveReconnect();
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
    const reconnectRefs: IStreamReconnectRefs = { reconnectDebounceRef, statusRef };

    const handleOnline = (): void => {
      scheduleStreamReconnect(reconnectRefs, setReconnectNonce);
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === "visible") {
        scheduleStreamReconnect(reconnectRefs, setReconnectNonce);
      }
    };

    const handleOffline = (): void => {
      setStatus("degraded");
    };

    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearStreamReconnectDebounce(reconnectDebounceRef);
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
    const abortController = new AbortController();

    const handleEvent = (event: INotificationStreamEvent): void => {
      handleNotificationStreamEvent(event, {
        pathname: pathnameRef.current,
        queryClient,
        suppressToasts: suppressToastsRef.current,
        userType,
      });
    };

    void runNotificationStream({
      abortController,
      accessToken,
      isCancelled: () => cancelled,
      onEvent: handleEvent,
      setStatus,
      streamClientId: streamClientIdRef.current,
    });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [accessToken, enabled, queryClient, reconnectNonce, userType]);

  return enabled && accessToken != null ? status : "idle";
}
