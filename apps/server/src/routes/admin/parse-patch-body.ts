import { parseJsonObject } from "./parse-body-utils";

export function parsePatchBody<TBody extends object>(options: {
  allowedFields: readonly string[];
  applyField: (record: Record<string, unknown>, body: TBody, field: string) => string | null;
  emptyMessage?: string;
  raw: unknown;
}): { body: TBody; ok: true } | { error: string; ok: false } {
  const record = parseJsonObject(options.raw);
  if (!record) {
    return { error: "Body must be a JSON object", ok: false };
  }

  const unknownKeys = Object.keys(record).filter((key) => !options.allowedFields.includes(key));
  if (unknownKeys.length > 0) {
    return { error: `Unknown fields: ${unknownKeys.join(", ")}`, ok: false };
  }

  const body = {} as TBody;
  for (const field of options.allowedFields) {
    const fieldError = options.applyField(record, body, field);
    if (fieldError) {
      return { error: fieldError, ok: false };
    }
  }

  if (Object.keys(body).length === 0) {
    return { error: options.emptyMessage ?? "At least one field is required", ok: false };
  }

  return { body, ok: true };
}
