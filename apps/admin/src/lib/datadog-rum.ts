import { datadogRum } from "@datadog/browser-rum";

import type { IUser } from "@/packages/shared";

const DEFAULT_DD_SITE = "us5.datadoghq.com";
const RUM_SERVICE = "tenanto-admin";

let rumInitialized = false;

function normalizeProxyUrl(proxyUrl: string): string {
  const trimmed = proxyUrl.replace(/\/$/, "");

  try {
    const url = new URL(trimmed);
    if (url.hostname === "0.0.0.0") {
      url.hostname = "localhost";
      console.warn(
        "[datadog-rum] VITE_DD_RUM_PROXY_URL uses 0.0.0.0, which browsers block. Using http://localhost instead."
      );
      return url.origin;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function getRumConfig() {
  const applicationId = import.meta.env.VITE_DD_RUM_APPLICATION_ID;
  const clientToken = import.meta.env.VITE_DD_CLIENT_TOKEN;
  const proxyUrl = import.meta.env.VITE_DD_RUM_PROXY_URL;

  if (!applicationId || !clientToken || !proxyUrl) {
    return null;
  }

  return {
    applicationId,
    clientToken,
    env: import.meta.env.VITE_DD_ENV ?? import.meta.env.MODE,
    proxyUrl: normalizeProxyUrl(proxyUrl),
    site: import.meta.env.VITE_DD_SITE ?? DEFAULT_DD_SITE,
    version: import.meta.env.VITE_APP_VERSION,
  };
}

function sanitizeUrl(url: unknown): unknown {
  if (typeof url !== "string") {
    return url;
  }

  return url.replace(/([?&](?:token|access_token|refresh_token)=)[^&]+/gi, "$1[redacted]");
}

export function initDatadogRum(): void {
  if (rumInitialized || typeof globalThis.window === "undefined") {
    return;
  }

  const config = getRumConfig();
  if (!config) {
    return;
  }

  datadogRum.init({
    applicationId: config.applicationId,
    beforeSend: (event) => {
      const view = event.view as { url?: string } | undefined;
      const resource = event.resource as { url?: string } | undefined;

      if (typeof view?.url === "string") {
        view.url = sanitizeUrl(view.url) as string;
      }
      if (typeof resource?.url === "string") {
        resource.url = sanitizeUrl(resource.url) as string;
      }
      return true;
    },
    clientToken: config.clientToken,
    defaultPrivacyLevel: "mask-user-input",
    env: config.env,
    proxy: (options: { parameters: string; path: string; subdomain?: string }) => {
      const params = new URLSearchParams(options.parameters);
      if (options.subdomain) {
        params.set("ddforwardSubdomain", options.subdomain);
      }
      return `${config.proxyUrl}${options.path}?${params.toString()}`;
    },
    service: RUM_SERVICE,
    sessionReplaySampleRate: 0,
    sessionSampleRate: 100,
    site: config.site,
    startSessionReplayRecordingManually: false,
    trackLongTasks: true,
    trackResources: true,
    trackUserInteractions: true,
    version: config.version,
  });

  rumInitialized = true;
}

export function isDatadogRumEnabled(): boolean {
  return rumInitialized;
}

export function setDatadogRumUser(user: IUser): void {
  if (!rumInitialized) {
    return;
  }

  datadogRum.setUser({
    email: user.email,
    id: user.id,
    name: user.name,
  });
}

export function clearDatadogRumUser(): void {
  if (!rumInitialized) {
    return;
  }

  datadogRum.clearUser();
}

export function trackDatadogRumView(name: string): void {
  if (!rumInitialized) {
    return;
  }

  datadogRum.startView({ name });
}

export function trackDatadogRumError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!rumInitialized) {
    return;
  }

  if (error instanceof Error) {
    datadogRum.addError(error, context);
    return;
  }

  datadogRum.addError(typeof error === "string" ? error : JSON.stringify(error), context);
}
