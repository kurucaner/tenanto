export function isExpenseCsvImportEnabled(): boolean {
  return (
    process.env["NODE_ENV"] !== "production" &&
    process.env["EXPENSE_CSV_IMPORT_ENABLED"] === "true"
  );
}

export function getOpenAiApiKey(): string | null {
  const key = process.env["OPENAI_API_KEY"];
  if (key == null || key.trim() === "") {
    return null;
  }
  return key.trim();
}
