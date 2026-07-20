export const TenantSmsInboundKeyword = {
  HELP: "help",
  STOP: "stop",
  UNKNOWN: "unknown",
} as const;

export type TTenantSmsInboundKeyword =
  (typeof TenantSmsInboundKeyword)[keyof typeof TenantSmsInboundKeyword];

const STOP_KEYWORDS = new Set(["CANCEL", "END", "QUIT", "STOP", "STOPALL", "UNSUBSCRIBE"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

function normalizeInboundToken(value: string): string {
  return (
    value
      .trim()
      .toUpperCase()
      .split(/\s+/)[0]
      ?.replace(/[^A-Z]/g, "") ?? ""
  );
}

/** Normalize inbound SMS body or AWS messageKeyword to STOP / HELP / unknown. */
export function parseTenantSmsInboundKeyword(message: string): TTenantSmsInboundKeyword {
  const token = normalizeInboundToken(message);
  if (!token) {
    return TenantSmsInboundKeyword.UNKNOWN;
  }
  if (STOP_KEYWORDS.has(token)) {
    return TenantSmsInboundKeyword.STOP;
  }
  if (HELP_KEYWORDS.has(token)) {
    return TenantSmsInboundKeyword.HELP;
  }
  return TenantSmsInboundKeyword.UNKNOWN;
}
