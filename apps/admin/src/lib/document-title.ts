import { APP_NAME } from "@/packages/shared";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function isLocalEnvironment(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  const hostname = globalThis.location?.hostname;
  if (!hostname) {
    return false;
  }

  return LOCAL_HOSTNAMES.has(hostname);
}

export function formatDocumentTitle(title = APP_NAME): string {
  return isLocalEnvironment() ? `${title} (local)` : title;
}

export function syncDocumentTitle(title = APP_NAME): void {
  document.title = formatDocumentTitle(title);
}
