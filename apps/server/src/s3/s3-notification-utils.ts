import { type S3NotificationEvent } from "./s3-types";

export function decodeS3ObjectKey(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, " "));
}

export function isObjectCreatedEvent(eventName: string): boolean {
  return eventName.includes("ObjectCreated");
}

export function parseS3NotificationEvent(raw: unknown): S3NotificationEvent | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const recordsRaw = record["Records"];
  if (!Array.isArray(recordsRaw)) return null;

  const records: S3NotificationEvent["Records"] = [];
  for (const item of recordsRaw) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
    const itemRecord = item as Record<string, unknown>;
    const eventName = itemRecord["eventName"];
    const s3Raw = itemRecord["s3"];
    if (typeof eventName !== "string") continue;
    if (s3Raw == null || typeof s3Raw !== "object" || Array.isArray(s3Raw)) continue;

    const s3Record = s3Raw as Record<string, unknown>;
    const objectRaw = s3Record["object"];
    if (objectRaw == null || typeof objectRaw !== "object" || Array.isArray(objectRaw)) continue;

    const objectRecord = objectRaw as Record<string, unknown>;
    const key = objectRecord["key"];
    if (typeof key !== "string" || key.length === 0) continue;

    const sizeRaw = objectRecord["size"];
    const size =
      typeof sizeRaw === "number"
        ? sizeRaw
        : typeof sizeRaw === "string"
          ? Number.parseInt(sizeRaw, 10)
          : undefined;

    records.push({
      eventName,
      s3: {
        object: {
          key,
          ...(Number.isFinite(size) ? { size: size as number } : {}),
        },
      },
    });
  }

  if (records.length === 0) return null;
  return { Records: records };
}
