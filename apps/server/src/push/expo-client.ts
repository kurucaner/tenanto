import Expo from "expo-server-sdk";

export interface PushMessage {
  body?: string;
  data?: Record<string, unknown>;
  title?: string;
  to: string | string[];
}

const expo = new Expo();

export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  const validMessages = messages.filter((m) => {
    const tokens = Array.isArray(m.to) ? m.to : [m.to];
    return tokens.every((t) => Expo.isExpoPushToken(t));
  });

  if (validMessages.length === 0) return;

  const chunks = expo.chunkPushNotifications(
    validMessages.map((m) => ({
      body: m.body,
      data: m.data,
      sound: "default" as const,
      title: m.title,
      to: m.to,
    }))
  );

  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}

export interface IPushSendSummary {
  errorTicketCount: number;
  okTicketCount: number;
  ticketErrors: string[];
}

/** Like {@link sendPushNotifications} but aggregates Expo ticket results for admin metrics. */
export async function sendPushNotificationsWithSummary(
  messages: PushMessage[]
): Promise<IPushSendSummary> {
  const validMessages = messages.filter((m) => {
    const tokens = Array.isArray(m.to) ? m.to : [m.to];
    return tokens.every((t) => Expo.isExpoPushToken(t));
  });

  if (validMessages.length === 0) {
    return { errorTicketCount: 0, okTicketCount: 0, ticketErrors: [] };
  }

  const chunks = expo.chunkPushNotifications(
    validMessages.map((m) => ({
      body: m.body,
      data: m.data,
      sound: "default" as const,
      title: m.title,
      to: m.to,
    }))
  );

  const ticketErrors: string[] = [];
  let okTicketCount = 0;
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (const t of tickets) {
      if (t.status === "ok") {
        okTicketCount += 1;
      } else {
        ticketErrors.push(t.message ?? "unknown_expo_error");
      }
    }
  }

  return {
    errorTicketCount: ticketErrors.length,
    okTicketCount,
    ticketErrors,
  };
}
