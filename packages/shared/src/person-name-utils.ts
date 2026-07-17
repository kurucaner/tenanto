export const PERSON_NAME_MAX_LENGTH = 255;

const PERSON_NAME_CHAR_REGEX = /^[\p{L}\p{M} .'-]+$/u;
const DOUBLED_PUNCTUATION_REGEX = /(--|''|\.\.)/;
const EDGE_PUNCTUATION_REGEX = /^[-'.]|[-'.]$/;

export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, " ").normalize("NFC");
}

export function getPersonNameValidationError(value: string): string | null {
  const normalized = normalizePersonName(value);

  if (!normalized) return "Name is required";
  if (normalized.length > PERSON_NAME_MAX_LENGTH) return "Name is too long";
  if (!/\p{L}/u.test(normalized)) return "Name must contain at least one letter";
  if (!PERSON_NAME_CHAR_REGEX.test(normalized)) return "Name contains invalid characters";
  if (DOUBLED_PUNCTUATION_REGEX.test(normalized)) return "Name has invalid punctuation";
  if (EDGE_PUNCTUATION_REGEX.test(normalized)) {
    return "Name cannot start or end with punctuation";
  }

  return null;
}

export function validatePersonName(name: unknown): string | null {
  if (typeof name !== "string") return "Name must be a string";
  return getPersonNameValidationError(name);
}
