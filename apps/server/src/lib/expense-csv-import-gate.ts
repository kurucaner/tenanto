export function getOpenAiApiKey(): string | null {
  const key = process.env["OPENAI_API_KEY"];
  if (key == null || key.trim() === "") {
    return null;
  }
  return key.trim();
}
