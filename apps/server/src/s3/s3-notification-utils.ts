import { type S3NotificationEvent } from "./s3-types";

export function decodeS3ObjectKey(key: string): string {
  return decodeURIComponent(key.replace(/\+/g, " "));
}

export function isObjectCreatedEvent(eventName: string): boolean {
  return eventName.includes("ObjectCreated");
}

function parseS3ObjectSize(sizeRaw: unknown): number | undefined {
  const size =
    typeof sizeRaw === "number"
      ? sizeRaw
      : typeof sizeRaw === "string"
        ? Number.parseInt(sizeRaw, 10)
        : undefined;
  return Number.isFinite(size) ? (size as number) : undefined;
}

function parseS3NotificationRecord(
  item: unknown
): S3NotificationEvent["Records"][number] | null {
  if (item == null || typeof item !== "object" || Array.isArray(item)) return null;

  const itemRecord = item as Record<string, unknown>;
  const eventName = itemRecord["eventName"];
  const s3Raw = itemRecord["s3"];
  if (typeof eventName !== "string") return null;
  if (s3Raw == null || typeof s3Raw !== "object" || Array.isArray(s3Raw)) return null;

  const objectRaw = (s3Raw as Record<string, unknown>)["object"];
  if (objectRaw == null || typeof objectRaw !== "object" || Array.isArray(objectRaw)) return null;

  const objectRecord = objectRaw as Record<string, unknown>;
  const key = objectRecord["key"];
  if (typeof key !== "string" || key.length === 0) return null;

  const size = parseS3ObjectSize(objectRecord["size"]);
  return {
    eventName,
    s3: {
      object: {
        key,
        ...(size !== undefined ? { size } : {}),
      },
    },
  };
}

export function parseS3NotificationEvent(raw: unknown): S3NotificationEvent | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;

  const recordsRaw = (raw as Record<string, unknown>)["Records"];
  if (!Array.isArray(recordsRaw)) return null;

  const records = recordsRaw
    .map(parseS3NotificationRecord)
    .filter((record): record is S3NotificationEvent["Records"][number] => record != null);

  if (records.length === 0) return null;
  return { Records: records };
}
