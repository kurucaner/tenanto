import {
  type IAdminSupportRequestPatchBody,
  type ISupportAttachmentInput,
  type ISupportAttachmentPresignBody,
  type ISupportAttachmentPresignFile,
  type ISupportAttachmentStatusBody,
  SUPPORT_ALLOWED_IMAGE_MIME_TYPES,
  SUPPORT_MAX_IMAGE_ATTACHMENTS,
  SUPPORT_MAX_IMAGE_BYTES,
  type SupportCategory,
  type SupportRequestStatus,
  type TAdminSupportRequestSettableStatus,
  type TSupportAllowedImageMimeType,
} from "@/packages/shared";

const ADMIN_SUPPORT_SETTABLE_STATUSES = new Set<TAdminSupportRequestSettableStatus>([
  "in_progress",
  "resolved",
]);

const SUPPORT_STATUSES = new Set<SupportRequestStatus>(["pending", "in_progress", "resolved"]);
const SUPPORT_CATEGORIES = new Set<SupportCategory>(["bug", "feature", "general"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Missing/empty → `undefined`; invalid shape → `null`; otherwise parsed status. */
export function parseOptionalSupportRequestStatus(
  raw: unknown
): SupportRequestStatus | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return SUPPORT_STATUSES.has(raw as SupportRequestStatus) ? (raw as SupportRequestStatus) : null;
}

/** Missing/empty → `undefined`; invalid shape → `null`; otherwise parsed category. */
export function parseOptionalSupportCategory(raw: unknown): SupportCategory | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  return SUPPORT_CATEGORIES.has(raw as SupportCategory) ? (raw as SupportCategory) : null;
}

export function parseSupportListLimit(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(100, Math.floor(n));
}

export function parseUuidParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return null;
  return UUID_RE.test(t) ? t : null;
}

export function parseSupportRequestPatchBody(
  raw: unknown
): { body: IAdminSupportRequestPatchBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const record = raw as Record<string, unknown>;
  const status = record["status"];
  if (
    typeof status !== "string" ||
    !ADMIN_SUPPORT_SETTABLE_STATUSES.has(status as TAdminSupportRequestSettableStatus)
  ) {
    return { error: 'status must be "in_progress" or "resolved"', ok: false };
  }
  return { body: { status: status as TAdminSupportRequestSettableStatus }, ok: true };
}

export function parseSupportMessageBody(
  raw: unknown
): { body: string; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const record = raw as Record<string, unknown>;
  const message = typeof record["message"] === "string" ? record["message"].trim() : "";
  if (message.length === 0) {
    return { error: "message is required", ok: false };
  }
  if (message.length > 2000) {
    return { error: "message must be at most 2000 characters", ok: false };
  }
  return { body: message, ok: true };
}

export function isValidSupportCategory(value: unknown): value is SupportCategory {
  return typeof value === "string" && SUPPORT_CATEGORIES.has(value as SupportCategory);
}

const ALLOWED_IMAGE_MIME_SET = new Set<string>(SUPPORT_ALLOWED_IMAGE_MIME_TYPES);

function parseAttachmentFilename(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return null;
  return trimmed;
}

function parseAttachmentContentType(raw: unknown): TSupportAllowedImageMimeType | null {
  if (typeof raw !== "string") return null;
  return ALLOWED_IMAGE_MIME_SET.has(raw) ? (raw as TSupportAllowedImageMimeType) : null;
}

function parseAttachmentSizeBytes(raw: unknown): number | null {
  const size = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(size) || size < 1 || size > SUPPORT_MAX_IMAGE_BYTES) return null;
  return Math.floor(size);
}

function parseAttachmentKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 512) return null;
  return trimmed;
}

function parsePresignFile(raw: unknown): ISupportAttachmentPresignFile | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const filename = parseAttachmentFilename(record["filename"]);
  const contentType = parseAttachmentContentType(record["contentType"]);
  const sizeBytes = parseAttachmentSizeBytes(record["sizeBytes"]);
  if (filename == null || contentType == null || sizeBytes == null) return null;
  return { contentType, filename, sizeBytes };
}

function parseCreateAttachment(raw: unknown): ISupportAttachmentInput | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const filename = parseAttachmentFilename(record["filename"]);
  const contentType = parseAttachmentContentType(record["contentType"]);
  const sizeBytes = parseAttachmentSizeBytes(record["sizeBytes"]);
  const key = parseAttachmentKey(record["key"]);
  if (filename == null || contentType == null || sizeBytes == null || key == null) return null;
  return { contentType, filename, key, sizeBytes };
}

export function parseSupportAttachmentPresignBody(
  raw: unknown
): { body: ISupportAttachmentPresignBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const record = raw as Record<string, unknown>;
  const filesRaw = record["files"];
  if (!Array.isArray(filesRaw)) {
    return { error: "files must be an array", ok: false };
  }
  if (filesRaw.length === 0) {
    return { error: "files must not be empty", ok: false };
  }
  if (filesRaw.length > SUPPORT_MAX_IMAGE_ATTACHMENTS) {
    return {
      error: `You can attach up to ${SUPPORT_MAX_IMAGE_ATTACHMENTS} images`,
      ok: false,
    };
  }

  const files: ISupportAttachmentPresignFile[] = [];
  for (const fileRaw of filesRaw) {
    const parsed = parsePresignFile(fileRaw);
    if (parsed == null) {
      return { error: "Invalid file metadata in files array", ok: false };
    }
    files.push(parsed);
  }

  return { body: { files }, ok: true };
}

export function parseSupportCreateAttachments(
  raw: unknown
): { attachments: ISupportAttachmentInput[]; ok: true } | { error: string; ok: false } {
  if (raw === undefined || raw === null) {
    return { attachments: [], ok: true };
  }
  if (!Array.isArray(raw)) {
    return { error: "attachments must be an array", ok: false };
  }
  if (raw.length > SUPPORT_MAX_IMAGE_ATTACHMENTS) {
    return {
      error: `You can attach up to ${SUPPORT_MAX_IMAGE_ATTACHMENTS} images`,
      ok: false,
    };
  }

  const attachments: ISupportAttachmentInput[] = [];
  for (const attachmentRaw of raw) {
    const parsed = parseCreateAttachment(attachmentRaw);
    if (parsed == null) {
      return { error: "Invalid attachment metadata", ok: false };
    }
    attachments.push(parsed);
  }

  return { attachments, ok: true };
}

export function parseSupportAttachmentStatusBody(
  raw: unknown
): { body: ISupportAttachmentStatusBody; ok: true } | { error: string; ok: false } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Body must be a JSON object", ok: false };
  }
  const record = raw as Record<string, unknown>;
  const keysRaw = record["keys"];
  if (!Array.isArray(keysRaw)) {
    return { error: "keys must be an array", ok: false };
  }
  if (keysRaw.length === 0) {
    return { error: "keys must not be empty", ok: false };
  }
  if (keysRaw.length > SUPPORT_MAX_IMAGE_ATTACHMENTS) {
    return {
      error: `You can check up to ${SUPPORT_MAX_IMAGE_ATTACHMENTS} keys`,
      ok: false,
    };
  }

  const keys: string[] = [];
  for (const keyRaw of keysRaw) {
    const key = parseAttachmentKey(keyRaw);
    if (key == null) {
      return { error: "Invalid key in keys array", ok: false };
    }
    keys.push(key);
  }

  return { body: { keys }, ok: true };
}
