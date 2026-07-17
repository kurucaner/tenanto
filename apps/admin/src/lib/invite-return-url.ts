export function getAcceptInvitePath(token: string): string {
  return `/accept-invite?token=${encodeURIComponent(token)}`;
}

export function parseSafeReturnTo(value: string | null): string | null {
  if (value == null || value === "") {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

export function buildAuthHrefWithReturnTo(path: string, returnTo: string): string {
  return `${path}?returnTo=${encodeURIComponent(returnTo)}`;
}
