import { APP_NAME } from "@/packages/shared";

export const TENANT_APP_TITLE = `${APP_NAME} Resident`;

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

export function isQaEnvironment(): boolean {
  const ddEnv = import.meta.env.VITE_DD_ENV?.trim().toLowerCase();
  return ddEnv === "qa";
}

function getEnvironmentTitleSuffix(): string | null {
  if (isLocalEnvironment()) {
    return "local";
  }
  if (isQaEnvironment()) {
    return "qa";
  }
  return null;
}

export function formatDocumentTitle(title = TENANT_APP_TITLE): string {
  const suffix = getEnvironmentTitleSuffix();
  return suffix ? `${title} (${suffix})` : title;
}

export function syncDocumentTitle(pageTitle?: string): void {
  const brandedTitle = formatDocumentTitle(TENANT_APP_TITLE);
  document.title = pageTitle ? `${pageTitle} · ${brandedTitle}` : brandedTitle;
}
