export function getGoogleClientId(): string | undefined {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return clientId != null && clientId !== "" ? clientId : undefined;
}

export function logGoogleAuth(stage: string, details?: Record<string, unknown>): void {
  console.log(`[google-auth] ${stage}`, {
    ...details,
    mode: import.meta.env.MODE,
    origin: typeof window !== "undefined" ? window.location.origin : undefined,
  });
}

export function warnGoogleAuth(stage: string, details?: Record<string, unknown>): void {
  console.warn(`[google-auth] ${stage}`, details ?? {});
}

export function errorGoogleAuth(stage: string, details?: Record<string, unknown>): void {
  console.error(`[google-auth] ${stage}`, details ?? {});
}
