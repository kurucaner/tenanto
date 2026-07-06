import crypto from "node:crypto";
import type { ServerResponse } from "node:http";

import type { FastifyReply } from "fastify";
import { Client } from "pg";

import { pool } from "@/db/pool";
import { userNotificationsDb } from "@/db/user-notifications";
import { buildSseCorsHeaders } from "@/lib/cors-headers";
import { type INotificationStreamEvent, type IUserNotification, UserType } from "@/packages/shared";

const NOTIFY_CHANNEL = "user_notifications";
const MAX_CONNECTIONS_PER_USER = 5;
const CONNECTION_MAX_AGE_MS = 3 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 25_000;

interface NotifyPayloadUser {
  kind?: "user_notifications";
  notification?: IUserNotification;
  userId: string;
}

interface NotifyPayloadSupport {
  kind: "support_request";
  supportRequestId: string;
  ticketUserId: string;
}

type NotifyPayload = NotifyPayloadUser | NotifyPayloadSupport;

interface SseConnection {
  clientId: string | null;
  closed: boolean;
  heartbeatTimer: ReturnType<typeof setInterval>;
  id: string;
  maxAgeTimer: ReturnType<typeof setTimeout>;
  registeredAt: number;
  res: ServerResponse;
  userId: string;
  userType: UserType;
}

function createListenClient(): Client {
  return new Client({
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: Number.parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER,
  });
}

function formatSseEvent(event: INotificationStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function writeToConnection(conn: SseConnection, event: INotificationStreamEvent): void {
  if (conn.closed || conn.res.writableEnded) return;
  conn.res.write(formatSseEvent(event));
}

function closeConnection(conn: SseConnection): void {
  if (conn.closed) return;
  conn.closed = true;
  clearInterval(conn.heartbeatTimer);
  clearTimeout(conn.maxAgeTimer);
  if (!conn.res.writableEnded) {
    conn.res.end();
  }
}

function parseNotifyPayload(raw: string | undefined): NotifyPayload | null {
  try {
    const payload = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    if (payload.kind === "support_request") {
      const supportRequestId = payload.supportRequestId;
      const ticketUserId = payload.ticketUserId;
      if (typeof supportRequestId === "string" && typeof ticketUserId === "string") {
        return { kind: "support_request", supportRequestId, ticketUserId };
      }
      return null;
    }
    const userId = payload.userId;
    if (typeof userId === "string" && userId !== "") {
      return { userId };
    }
    return null;
  } catch {
    return null;
  }
}

class NotificationStreamHub {
  private connections = new Map<string, Set<SseConnection>>();
  private initialized = false;
  private listenClient: Client | null = null;

  async start(): Promise<void> {
    if (this.initialized) return;

    const client = createListenClient();
    await client.connect();
    await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
    client.on("notification", (message) => {
      const payload = parseNotifyPayload(message.payload);
      if (payload == null) return;
      if (payload.kind === "support_request") {
        this.pushSupportRequestUpdated(payload.supportRequestId, payload.ticketUserId);
        return;
      }
      void this.pushToUser(payload.userId, payload.notification);
    });
    client.on("error", (err) => {
      console.error("[NotificationStreamHub] LISTEN client error:", err);
    });

    this.listenClient = client;
    this.initialized = true;
  }

  async stop(): Promise<void> {
    for (const set of this.connections.values()) {
      for (const conn of set) {
        closeConnection(conn);
      }
    }
    this.connections.clear();

    if (this.listenClient != null) {
      await this.listenClient.end().catch(() => undefined);
      this.listenClient = null;
    }
    this.initialized = false;
  }

  getConnectionCount(userId: string): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  async publish(userId: string, options?: { notification?: IUserNotification }): Promise<void> {
    await pool.query(`SELECT pg_notify($1, $2)`, [
      NOTIFY_CHANNEL,
      JSON.stringify({ notification: options?.notification, userId }),
    ]);
  }

  async publishSupportRequestUpdated(
    supportRequestId: string,
    ticketUserId: string
  ): Promise<void> {
    await pool.query(`SELECT pg_notify($1, $2)`, [
      NOTIFY_CHANNEL,
      JSON.stringify({ kind: "support_request", supportRequestId, ticketUserId }),
    ]);
  }

  async pushToUser(userId: string, notification?: IUserNotification): Promise<void> {
    if (notification != null) {
      this.broadcastToUser(userId, {
        data: { notification },
        type: "notifications.new",
        v: 1,
      });
    }

    const count = await userNotificationsDb.countUnread(userId);
    this.broadcastToUser(userId, {
      data: { count },
      type: "notifications.unread_count",
      v: 1,
    });
    this.broadcastToUser(userId, {
      data: {},
      type: "notifications.inbox_updated",
      v: 1,
    });
  }

  pushSupportRequestUpdated(supportRequestId: string, ticketUserId: string): void {
    const event: INotificationStreamEvent = {
      data: { supportRequestId },
      type: "support_request.updated",
      v: 1,
    };

    for (const set of this.connections.values()) {
      for (const conn of set) {
        if (conn.userId === ticketUserId || conn.userType === UserType.ADMIN) {
          writeToConnection(conn, event);
        }
      }
    }
  }

  register(
    userId: string,
    userType: UserType,
    reply: FastifyReply,
    initialCount: number,
    clientId?: string | null
  ): SseConnection {
    const existing = this.connections.get(userId) ?? new Set<SseConnection>();
    const normalizedClientId = clientId?.trim() || null;

    if (normalizedClientId != null) {
      for (const conn of [...existing]) {
        if (conn.clientId === normalizedClientId) {
          this.unregister(userId, conn.id);
        }
      }
    }

    while (existing.size >= MAX_CONNECTIONS_PER_USER) {
      const oldest = this.findOldestConnection(existing);
      if (oldest == null) break;
      this.unregister(userId, oldest.id);
    }

    reply.hijack();
    const res = reply.raw;
    const requestOrigin = reply.request.headers.origin;
    const corsHeaders = buildSseCorsHeaders(
      typeof requestOrigin === "string" ? requestOrigin : undefined
    );
    res.writeHead(200, {
      ...corsHeaders,
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    });

    const connection: SseConnection = {
      clientId: normalizedClientId,
      closed: false,
      heartbeatTimer: setInterval(() => {
        writeToConnection(connection, { data: {}, type: "ping", v: 1 });
      }, HEARTBEAT_INTERVAL_MS),
      id: crypto.randomUUID(),
      maxAgeTimer: setTimeout(() => {
        this.unregister(userId, connection.id);
      }, CONNECTION_MAX_AGE_MS),
      registeredAt: Date.now(),
      res,
      userId,
      userType,
    };

    const cleanup = (): void => {
      this.unregister(userId, connection.id);
    };
    res.on("close", cleanup);
    res.on("error", cleanup);

    existing.add(connection);
    this.connections.set(userId, existing);

    writeToConnection(connection, {
      data: { count: initialCount, serverTime: new Date().toISOString() },
      type: "connected",
      v: 1,
    });
    if (userType === UserType.USER) {
      writeToConnection(connection, {
        data: { count: initialCount },
        type: "notifications.unread_count",
        v: 1,
      });
    }

    return connection;
  }

  unregister(userId: string, connectionId: string): void {
    const set = this.connections.get(userId);
    if (set == null) return;

    for (const conn of set) {
      if (conn.id === connectionId) {
        closeConnection(conn);
        set.delete(conn);
        break;
      }
    }

    if (set.size === 0) {
      this.connections.delete(userId);
    }
  }

  private broadcastToUser(userId: string, event: INotificationStreamEvent): void {
    const set = this.connections.get(userId);
    if (set == null) return;

    for (const conn of set) {
      writeToConnection(conn, event);
    }
  }

  private findOldestConnection(connections: Set<SseConnection>): SseConnection | null {
    let oldest: SseConnection | null = null;
    for (const conn of connections) {
      if (oldest == null || conn.registeredAt < oldest.registeredAt) {
        oldest = conn;
      }
    }
    return oldest;
  }
}

export const notificationStreamHub = new NotificationStreamHub();
