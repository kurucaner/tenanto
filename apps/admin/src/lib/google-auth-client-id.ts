export function getGoogleClientId(): string | undefined {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return clientId != null && clientId !== "" ? clientId : undefined;
}
