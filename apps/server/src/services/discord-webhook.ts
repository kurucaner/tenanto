export const DISCORD_EMBED_FIELD_MAX = 1024;

export function truncateDiscordEmbedField(
  value: string,
  max: number = DISCORD_EMBED_FIELD_MAX
): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/** POST JSON to a Discord incoming webhook. No-op if URL is missing or empty. */
export async function postDiscordWebhook(
  webhookUrl: string | undefined,
  body: Record<string, unknown>
): Promise<void> {
  if (webhookUrl == null || webhookUrl === "") return;

  const response = await fetch(webhookUrl, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status}`);
  }
}
