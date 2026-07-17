export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 1) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const maskedLocal = `${local[0]}${"*".repeat(Math.max(1, local.length - 1))}`;
  return `${maskedLocal}@${domain}`;
}
