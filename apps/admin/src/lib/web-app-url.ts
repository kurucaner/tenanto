export function getWebAppUrl(): string {
  return (import.meta.env.VITE_WEB_APP_URL ?? "https://propertyos.app").replace(/\/$/, "");
}
