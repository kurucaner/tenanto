import {
  isValidE164,
  normalizeToE164,
  parsePhoneToParts,
  PHONE_DEFAULT_COUNTRY,
} from "@/packages/shared";

export interface ISmsInboundMessage {
  messageBody: string;
  messageKeyword: string | null;
  originationNumber: string;
}

function resolveE164Phone(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();
  const normalized =
    normalizeToE164(trimmed) ?? parsePhoneToParts(trimmed, PHONE_DEFAULT_COUNTRY).e164;
  if (!normalized || !isValidE164(normalized)) {
    return null;
  }

  return normalized;
}

function resolveMessageBody(record: Record<string, unknown>): string | null {
  const messageBody = record["messageBody"];
  if (typeof messageBody === "string") {
    return messageBody;
  }

  const message = record["message"];
  if (typeof message === "string") {
    return message;
  }

  return null;
}

function resolveMessageKeyword(record: Record<string, unknown>): string | null {
  const messageKeyword = record["messageKeyword"];
  return typeof messageKeyword === "string" ? messageKeyword : null;
}

function parseInboundRecord(raw: unknown): ISmsInboundMessage | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const originationNumber =
    resolveE164Phone(record["originationNumber"]) ?? resolveE164Phone(record["phoneNumber"]);
  const messageBody = resolveMessageBody(record);
  if (originationNumber == null || messageBody == null) {
    return null;
  }

  return {
    messageBody,
    messageKeyword: resolveMessageKeyword(record),
    originationNumber,
  };
}

function parseJsonString(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseSnsNotificationMessage(raw: Record<string, unknown>): ISmsInboundMessage | null {
  const messageRaw = raw["Message"];
  if (typeof messageRaw !== "string") {
    return null;
  }

  const parsedMessage = parseJsonString(messageRaw);
  return parseInboundRecord(parsedMessage);
}

/** Parse direct inbound payloads and SNS Notification wrappers. */
export function parseSmsInboundWebhookBody(raw: unknown): ISmsInboundMessage | null {
  const direct = parseInboundRecord(raw);
  if (direct != null) {
    return direct;
  }

  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const snsMessage = parseSnsNotificationMessage(record);
  if (snsMessage != null) {
    return snsMessage;
  }

  const nestedMessage = record["message"];
  if (nestedMessage != null && typeof nestedMessage === "object") {
    return parseInboundRecord(nestedMessage);
  }

  return null;
}
