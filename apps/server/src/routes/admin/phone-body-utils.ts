import { isValidE164, normalizeToE164 } from "@/packages/shared";

export function parseOptionalPhoneNumber(
  raw: unknown,
  fieldName = "phoneNumber"
): { error: string; ok: false } | { ok: true; phoneNumber: string | undefined } {
  if (raw == null || raw === "") {
    return { ok: true, phoneNumber: undefined };
  }
  if (typeof raw !== "string") {
    return { error: `${fieldName} must be a string`, ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, phoneNumber: undefined };
  }
  if (!isValidE164(trimmed)) {
    return { error: `${fieldName} must be a valid phone number`, ok: false };
  }
  const normalized = normalizeToE164(trimmed);
  if (!normalized) {
    return { error: `${fieldName} must be a valid phone number`, ok: false };
  }
  return { ok: true, phoneNumber: normalized };
}

export function parseNullablePhoneNumber(
  raw: unknown,
  fieldName = "phoneNumber"
): { error: string; ok: false } | { ok: true; phoneNumber: string | null } {
  if (raw == null || raw === "") {
    return { ok: true, phoneNumber: null };
  }
  if (typeof raw !== "string") {
    return { error: `${fieldName} must be a string or null`, ok: false };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, phoneNumber: null };
  }
  if (!isValidE164(trimmed)) {
    return { error: `${fieldName} must be a valid phone number`, ok: false };
  }
  const normalized = normalizeToE164(trimmed);
  if (!normalized) {
    return { error: `${fieldName} must be a valid phone number`, ok: false };
  }
  return { ok: true, phoneNumber: normalized };
}
